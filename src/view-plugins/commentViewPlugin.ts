import { syntaxTree, } from "@codemirror/language";
import { search, } from "@codemirror/search";
import { RangeSetBuilder, Text, EditorSelection, EditorState, RangeValue, RangeSet } from "@codemirror/state";
import {
    Decoration,
    DecorationSet,
    EditorView,
    PluginSpec,
    PluginValue,
    ViewPlugin,
    ViewUpdate,
    WidgetType, Command, getPanel
} from "@codemirror/view";
import $ from "jquery";
import { IterMode } from "@lezer/common"
import CommentPlugin from "src/main";
import { Comment, CommentProfile } from "../types"
import { Editor, EditorPosition, EditorRange, Notice } from "obsidian";
import { TSMap } from "typescript-map";
import { CommentsView } from "src/views/commentsView";
import CommentsHandler from "src/commentsHandler";

/**
 * Editor extension for marking comment backgrounds with profile colors.
 */
export class CommentViewPlugin implements PluginValue {
    decorations: DecorationSet;
    comments: TSMap<string, Comment>;
    view: EditorView;
    commentsView: CommentsView;
    commentsHandler: CommentsHandler;
    commentMarkings: TSMap<string, Decoration> = new TSMap<string, Decoration>();

    focusedOpacity: string = "1";
    unfocusedOpacity: string = "1";

    shouldUpdate: boolean = false;
    decorateDone: boolean = false;
    newCommenter: boolean = false;

    constructor(view: EditorView) {
        this.view = view;
        this.decorations = this.buildDecorations(view);
    }

    update(update: ViewUpdate) {
        //If the decorations are generate, add click event triggers.
        if (this.decorateDone) {
            let span = $("span.comment-highlight");
            span.each((i, e) => {
                let id = e.getAttr("data-comment-id");
                if (!id) return;
                let el = $(e);

                el.off("click").on("click", (ev) => {
                    let element = $(this.commentsView.containerEl).find(".comment-element[data-id='" + id + "']");
                    element.trigger("click", { scroll: ev.ctrlKey, dontSelect: true });
                })
            })

            $("span.comment-highlight-error").off("click").on("click", (val) => {
                new Notice("There is something wrong with these comment markings!");
            })
            this.decorateDone = false;
        }

        if ((update.docChanged || update.viewportChanged || this.shouldUpdate)) {
            this.decorations = this.buildDecorations(update.view);
            this.decorateDone = true;
            this.shouldUpdate = false;
        }

        //If text selection is changed or there is a new commenter, highlight the selected commented text (if any) with focusedOpacity. otherwise just put unfocusedOpacity
        if (update.selectionSet || this.newCommenter) {
            this.commentMarkings.forEach((val, key) => {
                let markSpan = $("span.comment-highlight[data-comment-id='" + key + "']");
                if (key) this.changeMarkingOpacity(this.unfocusedOpacity, markSpan, key, val);

                markSpan.parent().find("span:not(.comment-highlight)[data-comment-id='" + key + "']").addClass("marking-hidden");
            })

            let sel = update.state.selection;
            let selected = this.view.domAtPos(sel.main.from);
            let parent = selected.node.parentElement;
            if (!parent) return;

            let $parent = $(parent);
            let id = $parent.data("comment-id") as string;
            $parent = $("span.comment-highlight[data-comment-id='" + id + "']")

            if ($parent.hasClass("marking-hidden")) $parent = $parent.siblings(".comment-highlight[data-comment-id='" + id + "']");

            if (!$parent.hasClass("comment-highlight")) return;

            this.changeMarkingOpacity(this.focusedOpacity, $parent, id);
            $("span:not(.comment-highlight)[data-comment-id='" + id + "']").removeClass("marking-hidden");

        }
    }
    /**
     * Changes the marking opacity of a given element to the given opacity. 
     * @param opacity 
     * @param el 
     * @param id 
     * @param decoration 
     */
    changeMarkingOpacity(opacity: string, el: JQuery<HTMLElement>, id: string, decoration?: Decoration) {
        let deco = decoration ? decoration : this.commentMarkings.get("" + id);
        let str = deco.spec.attributes.style as string;

        let arr = str.split(",")
        arr.pop()
        arr.push(opacity + ");")

        str = arr.join(",")
        deco.spec.attributes.style = str;

        el.attr("style", str);
    }

    setComments(comments: TSMap<string, Comment>) {
        this.comments = comments;
    }
    setCommentsView(commentsView: CommentsView) {
        this.commentsView = commentsView;
    }
    setCommentsHandler(commentsHandler: CommentsHandler) {
        this.commentsHandler = commentsHandler;
        this.focusedOpacity = "" + commentsHandler.plugin.settings.focusedOpacity;
        this.unfocusedOpacity = "" + commentsHandler.plugin.settings.unfocusedOpacity;

        this.newCommenter = true;
    }
    /**
     * Triggers an update of the decorations.
     * @param force If the current decorations should be flushed, so that new decorations are generated from scratch.
     */
    triggerUpdate(force?: true) {
        if (force) this.commentMarkings = new TSMap<string, Decoration>();
        this.shouldUpdate = true;
        this.view.dispatch();
    }

    /**
     * Scroll to the comment markings at a given offset, if any.
     * @param offset The offset where to check for markings.
     * @param id The id of the target comment.
     * @param select If the editor should select the text or not.
     */
    scrollToComment(offset: number, id: number, select: boolean) {
        let pos = this.view.domAtPos(offset);
        if (!pos.node.parentElement) return;

        let span = pos.node.parentElement.find("span[data-comment-id='" + id + "']");
        if (!span || !span.getAttr("data-comment-id")) return;

        if (select) {
            this.view.dispatch({
                selection: {
                    anchor: offset + ("" + id).length + 2,
                    head: offset + ("" + id).length + 2,
                },
            });
        }

        let nextSpan = $(pos.node.parentElement).nextAll("div:has(span[data-comment-id='" + id + "'])")[0]?.find("span[data-comment-id='" + id + "']");
        this.scrollElementsCentered(this.view.scrollDOM, span, nextSpan ? nextSpan : span);
    }
    /**
     * Scroll a container to center one or two objects.
     * @param container The container to scroll.
     * @param element1 The first object to scroll to.
     * @param element2 The second object to scroll to, if any.
     */
    scrollElementsCentered(container: HTMLElement, element1: HTMLElement, element2: HTMLElement = element1): void {
        // Get the bounding rectangles of the elements and the container 
        let containerRect = container.getBoundingClientRect();
        let element1Rect = element1.getBoundingClientRect();
        let element2Rect = element2.getBoundingClientRect();

        // Calculate the average top position of the elements
        let combinedHeight = ((element2Rect.bottom) - (element1Rect.top));

        // Calculate the scroll position to bring the average top position into view
        let scrollTop = ((element1Rect.top + combinedHeight / 2) - container.offsetHeight / 2) + container.scrollTop - containerRect.top;

        // Scroll the container to the calculated position
        container.scrollTop = scrollTop;
    }

    buildDecorations(view: EditorView = this.view): DecorationSet {
        const builder = new RangeSetBuilder<Decoration>();

        if (!this.comments) return builder.finish();

        for (let { from, to } of view.visibleRanges) {
            syntaxTree(view.state).iterate({
                from: from,
                to: to,
                enter: (node) => {
                    const regex = /\|\d*\|.*?\|\|/gs;
                    let m: RegExpExecArray | null;

                    if (node.name != "Document") return;

                    while ((m = regex.exec(view.state.sliceDoc(node.from, node.to))) !== null) {
                        if (!m) break;
                        if (m.index === regex.lastIndex) regex.lastIndex++;

                        m.forEach((match, groupIndex) => {
                            if (!m) return builder.finish();

                            let splitMatch = match.split("|");
                            let id = splitMatch[1];

                            let comment = this.comments.get(id);
                            let commenter: CommentProfile;
                            let marking = this.commentMarkings.get(id);

                            let color = hexToRgb("#FF0000");
                            

                            if (comment) {
                                commenter = this.commentsHandler.getCommenterProfile(comment.commenterProfile);
                                color = hexToRgb(commenter.color);

                                //Create new Decoration if there are none already.
                                if (!marking && comment) { 
                                    marking = Decoration.mark({
                                        tagName: "span", attributes: {
                                            "style":
                                                "--bgc:" + color.r + "," + color.g + "," + color.b + ";" +
                                                "background-color:rgba(var(--bgc), " + this.unfocusedOpacity + ");",
                                            "data-comment-id": "" + comment.id,
                                            "class": "comment-highlight"
                                        }
                                    });
                                    this.commentMarkings.set(id, marking);
                                }

                                builder.add(
                                    m.index,
                                    m.index + splitMatch[1].length + 2,
                                    Decoration.mark({
                                        tagName: "span", attributes: {
                                            "class": "comment-marking marking-hidden", "data-comment-id": "" + comment.id, "style":
                                                "--bgc:" + color.r + "," + color.g + "," + color.b + ";" +
                                                "background-color:rgba(var(--bgc), " + this.unfocusedOpacity + ");"
                                        }
                                    }));

                                //Main comment highlight
                                builder.add(
                                    m.index + splitMatch[1].length + 2,
                                    m.index + match.length - 2,
                                    marking
                                );

                                builder.add(
                                    m.index + match.length - 2,
                                    m.index + match.length,
                                    Decoration.mark({
                                        tagName: "span", attributes: {
                                            "class": "comment-marking marking-hidden", "data-comment-id": "" + comment.id, "style":
                                                "--bgc:" + color.r + "," + color.g + "," + color.b + ";" +
                                                "background-color:rgba(var(--bgc), " + this.unfocusedOpacity + ");",
                                        }
                                    }));
                            } else {
                                // Error highlight.
                                marking = Decoration.mark({
                                    tagName: "span", attributes: {
                                        "style":
                                            "--bgc:" + color.r + "," + color.g + "," + color.b + ";" +
                                            "background-color:rgba(var(--bgc), " + this.unfocusedOpacity + ");",
                                        "class": "comment-highlight-error",
                                    }
                                });
                                this.commentMarkings.set(id, marking);
                                builder.add(
                                    m.index,
                                    m.index + match.length,
                                    marking
                                );
                            }
                        });
                    }
                },
            });
        }
        return builder.finish();
    }
    check(from: number, to: number, value: Decoration): false | void {
        return false;
    }
}

const pluginSpec: PluginSpec<CommentViewPlugin> = {
    decorations: (value: CommentViewPlugin) => value.decorations,
};

export const commentViewPlugin = ViewPlugin.fromClass(
    CommentViewPlugin,
    pluginSpec
);
function hexToRgb(hex: string) {
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : {
        r: 255,
        g: 0,
        b: 0
    };
}