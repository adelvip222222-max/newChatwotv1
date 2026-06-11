import Link from "next/link";
import { MessageSquare, Clock } from "lucide-react";

export function RecentConversationsWidget({ conversations, isAr }: { conversations: any[]; isAr: boolean }) {
  if (!conversations || conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800">
        <MessageSquare size={32} className="text-slate-300 mb-3" />
        <p className="text-sm text-slate-500">{isAr ? "لا توجد محادثات حديثة" : "No recent conversations"}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {conversations.map((conv) => {
        const date = new Date(conv.updatedAt).toLocaleTimeString(isAr ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' });
        return (
          <Link 
            key={conv.id} 
            href={`/dashboard/conversations?conversationId=${conv.id}`}
            className="flex items-center justify-between p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950 hover:border-primary-200 hover:shadow-sm transition-all"
          >
            <div className="flex items-center gap-4 truncate">
              <div className="h-10 w-10 flex-shrink-0 rounded-full bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400">
                <MessageSquare size={18} />
              </div>
              <div className="truncate">
                <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                  {conv.externalUserId}
                </p>
                <p className="text-xs text-slate-500 truncate mt-0.5 max-w-[200px] sm:max-w-[300px]">
                  {conv.lastMessage || (isAr ? "لا توجد رسائل" : "No messages")}
                </p>
              </div>
            </div>
            
            <div className="flex flex-col items-end gap-2 flex-shrink-0 pl-2 rtl:pr-2 rtl:pl-0">
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                conv.status === 'open' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
              }`}>
                {conv.status === 'open' ? (isAr ? 'مفتوحة' : 'Open') : (isAr ? 'مغلقة' : 'Closed')}
              </span>
              <div className="flex items-center gap-1 text-[10px] text-slate-400">
                <Clock size={10} />
                <span>{date}</span>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
