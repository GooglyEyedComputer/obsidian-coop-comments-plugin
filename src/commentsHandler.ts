import { TSMap } from "typescript-map";
import * as fs from 'fs';

import { Comment, CommentProfile, CommentReply } from "./types"
import CommentPlugin from "src/main";

TSMap.prototype.fromJSON = function (jsonObject, convertObjs) {
    var t = this;

    var setProperty: any = function (value: any) {
        if (value.id) return value as Comment; //Small edit to allow for comments to be read from json.

        if (value !== null && typeof value === 'object' && convertObjs) return new TSMap().fromJSON(value, true);

        if (Array.isArray(value) && convertObjs) return value.map(function (v) { return setProperty(v); });

        return value;
    };

    Object.keys(jsonObject).forEach(function (property) {
        if (jsonObject.hasOwnProperty(property)) {
            t.set(property, setProperty(jsonObject[property]));
        }
    });
    return t;
};

/**
 * Handles saving and loading comments and commenters, as well as passing them to other objects.
 */
export default class CommentsHandler { 
    commentsPath: string;
    plugin: CommentPlugin;

    commentsMap: TSMap<string, TSMap<string, Comment>>;
    commentersMap: TSMap<string, CommentProfile>;

    /**
     * Create the handler. Read the json file into memory. If the file does not exit, create it first.
     * @param basePath The path to the Obsidian vault
     * @param plugin An instance of CommentPlugin.
     */
    constructor(basePath: string, plugin: CommentPlugin,) {
        this.commentsPath = basePath + "/_comments.json";
        if (!fs.existsSync(this.commentsPath) || fs.readFileSync(this.commentsPath, "utf-8") == "") fs.writeFileSync(this.commentsPath, '{"commenters":{},"comments":{}}');

        this.commentsMap = new TSMap<string, TSMap<string, Comment>>();
        this.commentersMap = new TSMap<string, CommentProfile>();
        let json = JSON.parse(fs.readFileSync(this.commentsPath, "utf-8")); 
        this.commentsMap.fromJSON(json.comments, true);
        this.commentersMap.fromJSON(json.commenters, true);
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
        let comments: TSMap<string, Comment> | undefined = this.getComments(filePath);
        if (!comments) comments = this.commentsMap.set(filePath, new TSMap<string, Comment>()).get(filePath);

        let commenter = this.commentersMap.get(this.plugin.app.loadLocalStorage("comment-profile-name"));
        if (!commenter) commenter = this.commentersMap.set(this.plugin.settings.commenter.id, { id: this.plugin.settings.commenter.id, name: this.plugin.settings.commenter.name, color: this.plugin.settings.commenter.color }).get(this.plugin.settings.commenter.id);

        let lastKey = comments.keys().last();
        if (!lastKey) lastKey = "0"; //make sure to iterate on the last key, so that id is always unique.
        let id = parseInt(lastKey) + 1;

        let comment: Comment = { id: id, dateTime: new Date(), commentedText: selectedText, commenterProfile: this.plugin.settings.commenter.id, comment: commentText, replies: [], resolved: false };
        comments.sortedSet(id.toString(), comment);
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
        let comments: TSMap<string, Comment> | undefined = this.getComments(filePath);
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
    addCommenterProfile(commenter: CommentProfile){
        if(commenter){
            this.commentersMap.set(commenter.id, commenter);
            this.writeJSON();
        }
    }
    /**
     * Save edits to a given comment profile. Pulls information from plugin settings.
     * @param id The id of the comment profile to be edited.
     * @param newId The new id for the comment profile, if any.
     */
    editCommenterProfile(id:string, newId?:string){
        let commenter = this.commentersMap.get(id);

        if(newId){ //If there is a new id, go through every comment and replace old profile id with new one.
            commenter.id = newId;
            this.commentersMap.set(newId, commenter);
            this.commentersMap.delete(id);
            this.commentsMap.forEach((val)=>{
                val.forEach((comment)=> {
                    if(comment.commenterProfile == id) comment.commenterProfile = newId;
                    comment.replies.forEach((reply)=>reply.commenterProfile = reply.commenterProfile == id ? newId : reply.commenterProfile);
                })
            })
        } 
        commenter.color = this.plugin.settings.commenter.color; 
        commenter.name = this.plugin.settings.commenter.name; 

        this.writeJSON();
    }

    getComments(filePath: string): TSMap<string, Comment> | undefined {
        if (!filePath || filePath == "") throw null

        if (!this.commentsMap.has(filePath)) return undefined;

        return this.commentsMap.get(filePath);
    }

    getComment(filePath: string, id: number): Comment {
        let sid = id.toString();
        if (!filePath || filePath == "") throw null;

        let comments: TSMap<string, Comment> | undefined = this.getComments(filePath);
        if (!comments) throw null;
        if (!comments.has(sid)) throw null;

        return comments.get(sid);
    }

    getCommenterProfile(id:string): CommentProfile{
        return this.commentersMap.get(id); 
    }
    getCommenterProfiles(): CommentProfile[]{
        return this.commentersMap.values(); 
    }

    writeJSON() {
        let newJson = {"comments":this.commentsMap.toJSON(), "commenters":this.commentersMap.toJSON()}
        fs.writeFileSync(this.commentsPath, JSON.stringify(newJson, null, 1));
    }
}