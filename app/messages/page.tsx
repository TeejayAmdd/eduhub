'use client'

import { useState } from 'react'
import { PageContainer } from '@/_components/page-container'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Send, Search } from 'lucide-react'

interface Message {
  id: number
  sender: 'me' | 'them'
  text: string
  timestamp: string
}

interface Conversation {
  id: number
  name: string
  avatar: string
  lastMessage: string
  timestamp: string
  unread: number
  messages: Message[]
}

export default function MessagesPage() {
  const [selectedConversation, setSelectedConversation] = useState<number>(1)
  const [messageInput, setMessageInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  const [conversations, setConversations] = useState<Conversation[]>([
    {
      id: 1,
      name: 'Aarav Sharma',
      avatar: 'AS',
      lastMessage: 'Thanks for the feedback on the assignment!',
      timestamp: '2 min ago',
      unread: 0,
      messages: [
        { id: 1, sender: 'them', text: 'Hi teacher, I have a question about the math homework', timestamp: '10:30 AM' },
        { id: 2, sender: 'me', text: 'Sure, what is your question?', timestamp: '10:35 AM' },
        { id: 3, sender: 'them', text: 'How do I solve quadratic equations using the quadratic formula?', timestamp: '10:36 AM' },
        { id: 4, sender: 'me', text: 'You use the formula: x = (-b ± √(b²-4ac)) / 2a. Let me know if you need clarification', timestamp: '10:40 AM' },
        { id: 5, sender: 'them', text: 'Thanks for the feedback on the assignment!', timestamp: '11:05 AM' },
      ],
    },
    {
      id: 2,
      name: 'Priya Patel',
      avatar: 'PP',
      lastMessage: 'Can you review my project?',
      timestamp: '1 hour ago',
      unread: 2,
      messages: [
        { id: 1, sender: 'them', text: 'Hello! I submitted my science project', timestamp: '09:30 AM' },
        { id: 2, sender: 'me', text: 'Great! I will review it and give feedback', timestamp: '09:35 AM' },
        { id: 3, sender: 'them', text: 'Can you review my project?', timestamp: '10:00 AM' },
      ],
    },
    {
      id: 3,
      name: 'Rohan Kumar',
      avatar: 'RK',
      lastMessage: 'See you in class tomorrow',
      timestamp: '3 hours ago',
      unread: 0,
      messages: [
        { id: 1, sender: 'them', text: 'I will be absent today due to illness', timestamp: '08:00 AM' },
        { id: 2, sender: 'me', text: 'Okay, please send me the notes once you are back', timestamp: '08:05 AM' },
        { id: 3, sender: 'them', text: 'See you in class tomorrow', timestamp: '08:10 AM' },
      ],
    },
    {
      id: 4,
      name: 'Ananya Gupta',
      avatar: 'AG',
      lastMessage: 'Thank you!',
      timestamp: '5 hours ago',
      unread: 0,
      messages: [
        { id: 1, sender: 'them', text: 'Can I get extra credit opportunity?', timestamp: '06:00 AM' },
        { id: 2, sender: 'me', text: 'Yes, you can write a research paper on any topic', timestamp: '06:15 AM' },
        { id: 3, sender: 'them', text: 'Thank you!', timestamp: '06:20 AM' },
      ],
    },
    {
      id: 5,
      name: 'Class 10-A Group',
      avatar: 'C10A',
      lastMessage: 'Thanks for the class notes',
      timestamp: 'Yesterday',
      unread: 5,
      messages: [
        { id: 1, sender: 'them', text: 'Thanks for the class notes', timestamp: 'Yesterday' },
        { id: 2, sender: 'them', text: 'Can we have a doubt clearing session?', timestamp: 'Yesterday' },
      ],
    },
  ])

  const currentConversation = conversations.find((c) => c.id === selectedConversation)
  const filteredConversations = conversations.filter((conv) =>
    conv.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleSendMessage = () => {
    if (!messageInput.trim() || !currentConversation) return

    const newMessage: Message = {
      id: (currentConversation.messages[currentConversation.messages.length - 1]?.id || 0) + 1,
      sender: 'me',
      text: messageInput,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }

    const updatedConversations = conversations.map((conv) => {
      if (conv.id === selectedConversation) {
        return {
          ...conv,
          messages: [...conv.messages, newMessage],
          lastMessage: messageInput,
          timestamp: 'now',
        }
      }
      return conv
    })

    setConversations(updatedConversations)
    setMessageInput('')
  }

  return (
    <div className="flex h-full bg-background">
      {/* Conversation List Sidebar */}
      <div className="w-full md:w-80 border-r border-border flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-border">
          <h1 className="text-2xl font-bold mb-4">Messages</h1>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Conversations List */}
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-2">
            {filteredConversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => setSelectedConversation(conv.id)}
                className={`w-full text-left p-3 rounded-lg transition-colors ${
                  selectedConversation === conv.id
                    ? 'bg-accent'
                    : 'hover:bg-muted'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                    {conv.avatar}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-semibold truncate">{conv.name}</h3>
                      {conv.unread > 0 && (
                        <Badge className="ml-2">{conv.unread}</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {conv.lastMessage}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {conv.timestamp}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Chat Panel */}
      <div className="hidden md:flex flex-col flex-1">
        {currentConversation ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-border flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 text-white flex items-center justify-center font-bold flex-shrink-0">
                {currentConversation.avatar}
              </div>
              <div>
                <h2 className="font-semibold">{currentConversation.name}</h2>
                <p className="text-xs text-muted-foreground">Active now</p>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-3">
                {currentConversation.messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${
                      msg.sender === 'me' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    <div
                      className={`max-w-xs px-4 py-2 rounded-lg ${
                        msg.sender === 'me'
                          ? 'bg-blue-600 text-white'
                          : 'bg-muted'
                      }`}
                    >
                      <p className="text-sm">{msg.text}</p>
                      <p
                        className={`text-xs mt-1 ${
                          msg.sender === 'me'
                            ? 'text-blue-100'
                            : 'text-muted-foreground'
                        }`}
                      >
                        {msg.timestamp}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            {/* Message Input */}
            <div className="p-4 border-t border-border flex gap-2">
              <Input
                placeholder="Type a message..."
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') handleSendMessage()
                }}
              />
              <Button
                onClick={handleSendMessage}
                disabled={!messageInput.trim()}
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <p>Select a conversation to start messaging</p>
          </div>
        )}
      </div>
    </div>
  )
}
