'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Plus, Clock, Search } from 'lucide-react';
import { useChatStore } from '@/store/chat.store';
import { useUIStore } from '@/store/ui.store';

export default function ChatListPage() {
  const { conversations, setCurrentConversation } = useChatStore();
  const { language } = useUIStore();
  const router = useRouter();
  const [search, setSearch] = useState('');

  const filtered = conversations.filter(c => 
    c.title.toLowerCase().includes(search.toLowerCase())
  );

  const createNew = () => {
    const id = `conv_${Date.now()}`;
    const newConv = {
      id,
      title: language === 'ar' ? 'محادثة جديدة' : 'New Conversation',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messageCount: 0
    };
    useChatStore.getState().addConversation(newConv);
    router.push(`/chat/${id}`);
  };

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <MessageSquare className="w-6 h-6" />
          {language === 'ar' ? 'المحادثات' : 'Conversations'}
          <Badge variant="secondary">{conversations.length}</Badge>
        </h1>
        <Button onClick={createNew}><Plus className="w-4 h-4 mr-2" />{language === 'ar' ? 'جديد' : 'New'}</Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={language === 'ar' ? 'بحث في المحادثات...' : 'Search conversations...'}
          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-10 pr-4 py-2.5 text-sm outline-none focus:border-zinc-700"
        />
      </div>

      <div className="grid gap-3">
        {filtered.length === 0 ? (
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="p-12 text-center">
              <MessageSquare className="w-10 h-10 mx-auto mb-3 text-zinc-600" />
              <div className="text-sm text-zinc-400">{language === 'ar' ? 'لا توجد محادثات بعد' : 'No conversations yet'}</div>
              <Button onClick={createNew} className="mt-4" size="sm">+ {language === 'ar' ? 'ابدأ محادثة' : 'Start Chat'}</Button>
            </CardContent>
          </Card>
        ) : (
          filtered.map(conv => (
            <Card key={conv.id} className="bg-zinc-900 border-zinc-800 hover:border-zinc-700 cursor-pointer transition-colors" onClick={() => { setCurrentConversation(conv.id); router.push(`/chat/${conv.id}`); }}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{conv.title}</div>
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-zinc-500">
                      <Clock className="w-3 h-3" /> {new Date(conv.updatedAt).toLocaleDateString('ar-EG')} • {conv.messageCount} messages
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px]">RTL</Badge>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
