export type UserSession={userId:string;displayName:string;canReview:boolean};
export interface AuthAdapter {signIn():Promise<UserSession>;signOut():Promise<void>;current():Promise<UserSession|null>}
export interface PaymentAdapter {purchase(productId:string):Promise<{orderId:string}>}
// 后端以内部userId聚合邮箱/微信/Apple身份。角色与付费权益由服务端授予。
