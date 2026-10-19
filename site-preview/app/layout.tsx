import type {Metadata} from "next";
export const metadata:Metadata={title:"流动工位 · FlowSeat",description:"寻找适合打开笔记本的工作空间"};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="zh-CN"><body>{children}</body></html>;}
