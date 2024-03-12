export type CommentProfile = {
	id: string,
	name: string,
	color: string,
}
export type Comment= {
	id: number,
	commenterProfile: string,
	commentedText: string,
	comment: string,
	dateTime: Date,
	replies: CommentReply[],
	resolved: boolean
}
export type CommentReply = {
	commenterProfile: string,
	reply: string
	dateTime: Date,
}