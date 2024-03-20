import { Comment, CommentProfile, CommentReply } from "./types"
import CommentPlugin from "src/main";

/**
 * Handles saving and loading comments and commenters, as well as passing them to other objects.
 */
export default class CommentsHandler {
    commentsPath: string = "_comments.json";
    plugin: CommentPlugin;

    commentsMap: Map<string, Map<string, Comment>>;
    commentersMap: Map<string, CommentProfile>;

    /**
     * Create the handler. Read the json file into memory. If the file does not exit, create it first.
     * @param basePath The path to the Obsidian vault
     * @param plugin An instance of CommentPlugin.
     */
    constructor(plugin: CommentPlugin,) {
        this.plugin = plugin;
    }

    /**
     * Add a comment to memory and save it to the json file
     * @param filePath The path of the currently opened file, relative to the vaults root.
     * @param selectedText The text that is selected in the editor, that should be commented.
     * @param commentText The text of the comment.
     * @param postAdd A function to call after the addition of the comment is done.
     * @returns The added comment.
     */
    addComment(filePath: string, selectedText: string, commentText: string, postAdd?: (comment: Comment) => any): Comment | undefined {
        let comments: Map<string, Comment> | undefined = this.getComments(filePath);
        if (!comments) comments = this.commentsMap.set(filePath, new Map<string, Comment>()).get(filePath);
        if (!comments) return;

        let commenter = this.commentersMap.get(this.plugin.app.loadLocalStorage("CommentPlugin:comment-profile-name"));
        if (!commenter) commenter = this.commentersMap.set(this.plugin.settings.commenter.id, { id: this.plugin.settings.commenter.id, name: this.plugin.settings.commenter.name, color: this.plugin.settings.commenter.color }).get(this.plugin.settings.commenter.id);

        let id = "0";
        while (this.commentsMap.get(filePath)?.has(id)) id = "" + (parseInt(id) + 1); //make sure to iterate on the last key, so that id is always unique.

        let comment: Comment = { id: parseInt(id), dateTime: new Date(), commentedText: selectedText, commenterProfile: this.plugin.settings.commenter.id, comment: commentText, replies: [], resolved: false };
        comments.set(id.toString(), comment);
        this.writeJSON();

        if (postAdd) postAdd(comment);
        return comment;
    }
    /**
     * Edit the text of a given comment.
     * @param filePath The path of the currently opened file, relative to the vaults root.
     * @param id The id of the comment to be edited.
     * @param newText The new text of the comment
     */
    editComment(filePath: string, id: number, newText: string) {
        let comment: Comment = this.getComment(filePath, id);
        if (comment.commenterProfile != this.plugin.settings.commenter.id) return;

        comment.comment = newText;
        this.writeJSON();
    }
    /**
     * Flip the "resolved" switch in a comment (currently unused).
     * @param filePath The path of the currently opened file, relative to the vaults root.
     * @param id The id of the comment to be resolved.
     * @param shouldResolve If the comment should be resolved or not.
     */
    resolveComment(filePath: string, id: number, shouldResolve: boolean) {
        let comment: Comment = this.getComment(filePath, id);
        if (comment.commenterProfile != this.plugin.settings.commenter.id) return;

        comment.resolved = shouldResolve;
        this.writeJSON();
    }
    /**
     * Remove a given comment.
     * @param filePath The path of the currently opened file, relative to the vaults root.
     * @param id The id of the comment to be removed.
     * @param postRemove A function to be called after the comments removal.
     */
    removeComment(filePath: string, id: number, postRemove?: (comment: Comment) => any) {
        let comments: Map<string, Comment> | undefined = this.getComments(filePath);
        if (!comments) return;

        let comment: Comment = this.getComment(filePath, id);
        if (comment.commenterProfile != this.plugin.settings.commenter.id) return;

        comments.delete(id.toString());

        if (postRemove) postRemove(comment);
        this.writeJSON();
    }
    /**
     * Add a reply to a given comment
     * @param filePath The path of the currently opened file, relative to the vaults root.
     * @param id The id of the comment to add a reply to.
     * @param replyText The text of the reply.
     * @returns 
     */
    addCommentReply(filePath: string, id: number, replyText: string): CommentReply | undefined {
        let comment: Comment = this.getComment(filePath, id);
        if (!comment.replies.length) comment.replies = [];

        let newReply = { dateTime: new Date(), commenterProfile: this.plugin.settings.commenter.id, reply: replyText };
        this.getComment(filePath, id)?.replies.push(newReply);

        this.writeJSON();
        return newReply;
    }
    /**
     * Add a commenter to memory and save everything to the json file
     * @param commenter The commenter to be added.
     */
    addCommenterProfile(commenter: CommentProfile) {
        if (commenter) {
            this.commentersMap.set(commenter.id, commenter);
            this.writeJSON();
        }
    }
    /**
     * Save edits to a given comment profile. Pulls information from plugin settings.
     * @param id The id of the comment profile to be edited.
     * @param newId The new id for the comment profile, if any.
     */
    editCommenterProfile(id: string, newId?: string) {
        let commenter = this.commentersMap.get(id);
        if (!commenter) return;

        if (newId) { //If there is a new id, go through every comment and replace old profile id with new one.
            commenter.id = newId;
            this.commentersMap.set(newId, commenter);
            this.commentersMap.delete(id);
            this.commentsMap.forEach((val) => {
                val.forEach((comment) => {
                    if (comment.commenterProfile == id) comment.commenterProfile = newId;
                    comment.replies.forEach((reply) => reply.commenterProfile = reply.commenterProfile == id ? newId : reply.commenterProfile);
                })
            })
        }
        commenter.color = this.plugin.settings.commenter.color;
        commenter.name = this.plugin.settings.commenter.name;

        this.writeJSON();
    }

    getComments(filePath: string): Map<string, Comment> | undefined {
        if (!filePath || filePath == "") throw null

        if (!this.commentsMap.has(filePath)) return undefined;

        return this.commentsMap.get(filePath);
    }

    getComment(filePath: string, id: number): Comment {
        let sid = id.toString();
        if (!filePath || filePath == "") throw null;

        let comments: Map<string, Comment> | undefined = this.getComments(filePath);
        if (!comments) throw null;
        if (!comments.has(sid)) throw null;

        let comment = comments.get(sid);
        if (!comment) throw null;

        return comment;
    }

    getCommenterProfile(id: string): CommentProfile {
        let commenter = this.commentersMap.get(id);
		if(!commenter) throw new Error("There are no profiles with the id: " + id)
        return commenter;
    } 
    getCommenterProfileIfExists(id: string): CommentProfile | undefined {
        let commenter = this.commentersMap.get(id);
        return commenter;
    } 
    hasCommenterProfile(id: string): boolean {
        return this.commentersMap.has(id);
    }
    getCommenterProfiles(): CommentProfile[] {
        return Array.from(this.commentersMap.values());
    }

    writeJSON() {
        let newJson = { "comments": this.objectifyCommentsMap(), "commenters": Object.fromEntries(this.commentersMap) }
        this.plugin.app.vault.adapter.write(this.commentsPath, JSON.stringify(newJson, null, 1));
    }

    async readJSON() {
        if (!await this.plugin.app.vault.adapter.exists(this.commentsPath) || await this.plugin.app.vault.adapter.read(this.commentsPath) == "") {
            await this.plugin.app.vault.adapter.write(this.commentsPath, '{"commenters":{},"comments":{}}')
            await this.readJSON();
        }
        let content = await this.plugin.app.vault.adapter.read(this.commentsPath); 
 
        let json = await JSON.parse(content); 

        this.commentsMap = await this.createCommentsMap(json.comments);  
        this.commentersMap = await new Map<string, CommentProfile>(Object.entries(json.commenters));
    }
    /**
     * Makes a map from a JSON object, and makes sure to initiate nested maps.
     * @param object The JSON object to be converted.
     * @returns The created map.
     */
    createCommentsMap(object: JSON): Map<string, Map<string, Comment>>{ //TODO: make generic??
        let map = new Map<string, Map<string, Comment>>(Object.entries(object));
        map.forEach((entry, key)=>{
            let comments = new Map<string, Comment>(Object.entries(entry));
            map.set(key, comments)
        })
        return map;
    }
    /**
     * Makes comments maps ready to be stringified. Makes the map and nested maps into objects.
     * @returns The object created from commentsMap.
     */
    objectifyCommentsMap(): Object { //TODO: make generic??
        let map = Object.fromEntries<any>(this.commentsMap);
        this.commentsMap.forEach((e, k) => {
            map[k] = Object.fromEntries(e);
        })
        return map;
    }
}