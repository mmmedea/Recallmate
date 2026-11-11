"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";

interface ReviewClientProps {
  documentId: string;
}

export default function ReviewClient({ documentId }: ReviewClientProps) {
  const router = useRouter();
  const openMedea = useAppStore(state => state.setChatDrawerOpen);
  const [items, setItems] = useState<any[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [showAnswer, setShowAnswer] = useState(false);

  useEffect(() => {
    async function initSession() {
      try {
        const res = await fetch("/api/learning/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ documentId, requestedSize: 10 })
        });
        const data = await res.json();
        if (!data.success) {
          setError(data.error || data.message || "Failed to start session.");
        } else {
          setItems(data.items);
          setSessionId(data.sessionId);
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    initSession();
  }, [documentId]);

  const submitReview = async (wasCorrect: boolean, rating?: number) => {
    const currentItem = items[currentIndex];
    
    // Optimistically go to next
    setShowAnswer(false);
    setCurrentIndex(prev => prev + 1);

    try {
      await fetch("/api/learning/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          learningItemId: currentItem.learningItemId,
          reviewSessionId: sessionId,
          requestId: crypto.randomUUID(),
          wasCorrect,
          rating
        })
      });
    } catch (e) {
      console.error("Failed to submit review", e);
    }
  };

  if (loading) return <div>Loading review session...</div>;
  if (error) return <div className="text-red-500">{error}</div>;
  if (items.length === 0) return <div>You are all caught up! No items to review.</div>;

  if (currentIndex >= items.length) {
    return (
      <div className="p-6 text-center border rounded-lg bg-green-50">
        <h2 className="text-xl font-bold text-green-800">Review Complete!</h2>
        <p className="mt-2 text-green-700">Great job. Check back tomorrow for your next reviews.</p>
      </div>
    );
  }

  const currentItem = items[currentIndex];

  return (
    <div className="p-6 border rounded-lg shadow-sm bg-white">
      <div className="mb-4 text-sm text-gray-500">
        Concept {currentIndex + 1} of {items.length}
      </div>
      
      <h2 className="text-lg font-medium mb-6">{currentItem.questionText}</h2>
      
      {!showAnswer ? (
        <div className="space-y-4">
          <button 
            className="w-full py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            onClick={() => setShowAnswer(true)}
          >
            Show Answer
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="p-4 bg-gray-50 border rounded-md">
            <h3 className="font-semibold text-gray-700 mb-2">Answer Explanation:</h3>
            <p className="text-gray-800">{currentItem.explanation}</p>
            {currentItem.sourceChunkId && (
              <p className="mt-4 text-sm text-blue-600">
                <a href="#" className="underline">Source Citation</a>
              </p>
            )}
          </div>
          
          <div className="pt-4 border-t">
            <h3 className="text-center font-medium mb-4">How did that feel?</h3>
            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={() => submitReview(false, 1)} 
                className="py-2 bg-red-100 text-red-700 rounded-md hover:bg-red-200"
              >
                Again
              </button>
              <div className="flex space-x-2">
                <button 
                  onClick={() => submitReview(true, 2)}
                  className="flex-1 py-2 bg-yellow-100 text-yellow-800 rounded-md hover:bg-yellow-200"
                >
                  Hard
                </button>
                <button 
                  onClick={() => submitReview(true, 3)}
                  className="flex-1 py-2 bg-green-100 text-green-800 rounded-md hover:bg-green-200"
                >
                  Good
                </button>
                <button 
                  onClick={() => submitReview(true, 4)}
                  className="flex-1 py-2 bg-blue-100 text-blue-800 rounded-md hover:bg-blue-200"
                >
                  Easy
                </button>
              </div>
            </div>
            
            <div className="mt-6 flex justify-center space-x-4">
              <button onClick={() => router.push(`/notes/${documentId}`)} className="text-sm text-gray-500 hover:text-gray-900 underline">Review Notes</button>
              <button onClick={() => openMedea(true)} className="text-sm text-gray-500 hover:text-gray-900 underline">Ask Medea</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
