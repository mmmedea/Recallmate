-- ==========================================
-- RECALLMATE V2 SUPABASE DATABASE SCHEMA
-- ==========================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE,
    is_premium BOOLEAN DEFAULT FALSE,
    hearts INTEGER DEFAULT 15,
    last_heart_lost_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Documents Table (Uploaded PDFs, DOCX, Media)
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_type TEXT,
    raw_content_url TEXT,
    summary TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Active Recall Question & Attempt History
CREATE TABLE IF NOT EXISTS active_recall_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    user_answer TEXT,
    correct_answer TEXT,
    difficulty TEXT CHECK (difficulty IN ('easy', 'medium', 'hard')),
    is_correct BOOLEAN DEFAULT FALSE,
    attempted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Study Streaks Table
CREATE TABLE IF NOT EXISTS study_streaks (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    current_streak INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,
    last_activity_date DATE DEFAULT CURRENT_DATE
);

-- 5. Heart Transactions Log (Deductions, Regens, Feynman Quests)
CREATE TABLE IF NOT EXISTS heart_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    change_amount INTEGER NOT NULL,
    reason TEXT CHECK (reason IN ('incorrect_answer', 'regen', 'feynman_quest', 'admin_grant')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performant queries
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_recall_history_user_id ON active_recall_history(user_id);
CREATE INDEX IF NOT EXISTS idx_heart_transactions_user_id ON heart_transactions(user_id);
