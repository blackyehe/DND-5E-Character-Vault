export interface ReviewStat {label:string;before:string;after:string}
export interface DefinitionReviewRow {
 id:string;name:string;updatedAt:string;reviewHash:string;alreadyReviewed:boolean;blocked?:boolean
 sourceConfirmation:boolean;warnings:string[];changes:{field:string;before:unknown;after:unknown}[];statistics?:ReviewStat[]
}
export interface DefinitionReview {revision:number;characters:DefinitionReviewRow[]}
