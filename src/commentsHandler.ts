import { TSMap } from "typescript-map";
import * as fs from 'fs';

import { Comment, CommentProfile, CommentReply } from "./types"
import CommentPlugin from "src/main";

TSMap.prototype.fromJSON = function (jsonObject, convertObjs) {
    var t = this;

    var setProperty: any = function (value: any) {
        if (value.id) return value as Comment;

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
export default class CommentsHandler {
    commentsPath: string;
    plugin: CommentPlugin;

    //This is the map of the comments. Map<filePath, TSMap<id,Comment>>
    commentsMap: TSMap<string, TSMap<string, Comment>>;
    commentersMap: TSMap<string, CommentProfile>;

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

    //Add comment to commentsObject
    addComment(filePath: string, selectedText: string, commentText: string, postAdd?: (comment: Comment) => any): Comment | undefined {
        let comments: TSMap<string, Comment> | undefined = this.getComments(filePath);
        if (!comments) comments = this.commentsMap.set(filePath, new TSMap<string, Comment>()).get(filePath);

        let commenter = this.commentersMap.get(this.plugin.app.loadLocalStorage("comment-profile-name"));
        if (!commenter) commenter = this.commentersMap.set(this.plugin.settings.commenter.id, { id: this.plugin.settings.commenter.id, name: this.plugin.settings.commenter.name, color: this.plugin.settings.commenter.color }).get(this.plugin.settings.commenter.id);

        let lastKey = comments.keys().last();
        if (!lastKey) lastKey = "0";

        let id = parseInt(lastKey) + 1;
        let comment: Comment = { id: id, dateTime: new Date(), commentedText: selectedText, commenterProfile: this.plugin.settings.commenter.id, comment: commentText, replies: [], resolved: false };
        comments.sortedSet(id.toString(), comment);
        this.writeJSON();
        if (postAdd) postAdd(comment);

        return comment;
    }

    editComment(filePath: string, id: number, newText: string) {
        let comment: Comment = this.getComment(filePath, id);
        if (comment.commenterProfile != this.plugin.settings.commenter.id) return;

        comment.comment = newText;
        this.writeJSON();
    }

    resolveComment(filePath: string, id: number, shouldResolve: boolean) {
        let comment: Comment = this.getComment(filePath, id);
        if (comment.commenterProfile != this.plugin.settings.commenter.id) return;

        comment.resolved = shouldResolve;
        this.writeJSON();
    }
    removeComment(filePath: string, id: number, postRemove?: (comment: Comment) => any) {
        let comments: TSMap<string, Comment> | undefined = this.getComments(filePath);
        if (!comments) return;

        let comment: Comment = this.getComment(filePath, id);
        if (comment.commenterProfile != this.plugin.settings.commenter.id) return;

        comments.delete(id.toString());

        if (postRemove) postRemove(comment);

        this.writeJSON();
    }

    addCommentReply(filePath: string, id: number, replyText: string): CommentReply | undefined {
        let comment: Comment = this.getComment(filePath, id);
        if (!comment.replies.length) comment.replies = [];

        let newReply = { dateTime: new Date(), commenterProfile: this.plugin.settings.commenter.id, reply: replyText };
        this.getComment(filePath, id)?.replies.push(newReply);
        this.writeJSON();
        return newReply;
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
    addCommenterProfile(commenter: CommentProfile){
        if(commenter){
            this.commentersMap.set(commenter.id, commenter);
            this.writeJSON();
        }
    }
    editCommenterProfile(id:string, newId?:string){
        let commenter = this.commentersMap.get(id);

        if(newId){
            commenter.id = newId;
            this.commentersMap.set(newId, commenter)
            this.commentersMap.delete(id);
            this.commentsMap.forEach((val)=>{
                val.forEach((comment)=> {
                    if(comment.commenterProfile == id) comment.commenterProfile = newId;
                    comment.replies.forEach((reply)=>reply.commenterProfile = reply.commenterProfile == id ? newId : reply.commenterProfile)
                })
            })
        } 
        commenter.color = this.plugin.settings.commenter.color; 
        commenter.name = this.plugin.settings.commenter.name; 
        this.writeJSON()
    }

    writeJSON() {
        let newJson = {"comments":this.commentsMap.toJSON(), "commenters":this.commentersMap.toJSON()}
        fs.writeFileSync(this.commentsPath, JSON.stringify(newJson, null, 1));
        // this.plugin.updateViews()
    }
}