# MAKKARI AI — Storage Buckets Documentation

Makkari uses Supabase Storage for secure file handling across avatars and chat attachments.

---

## 📁 Storage Buckets Overview

### 1. `avatars` Bucket
- **Visibility**: Public Read (`public: true`)
- **Max File Size**: 5 MB (`5242880` bytes)
- **Allowed MIME Types**: `image/jpeg`, `image/png`, `image/webp`
- **File Structure**: `avatars/{user_id}/avatar.png`

#### RLS Security Policies
- **Read Policy**: `Public Read Avatars` — Anyone can view avatars.
- **Upload Policy**: `Authenticated Users Upload Avatar` — Restricted to folder matching `auth.uid()`.
- **Update Policy**: `Users Update Own Avatar` — Restricted to owner folder matching `auth.uid()`.
- **Delete Policy**: `Users Delete Own Avatar` — Restricted to owner folder matching `auth.uid()`.

---

### 2. `chat-attachments` Bucket
- **Visibility**: Private Read (`public: false`)
- **Max File Size**: 25 MB (`26214400` bytes)
- **Allowed MIME Types**: `image/jpeg`, `image/png`, `image/webp`, `application/pdf`, `text/plain`, `text/markdown`, `application/json`
- **File Structure**: `chat-attachments/{user_id}/{chat_id}/{filename}`

#### RLS Security Policies
- **Read Policy**: `Users Read Own Attachments` — Only owner authenticated matching `auth.uid()` folder can download/view.
- **Upload Policy**: `Users Upload Own Attachments` — Only owner authenticated matching `auth.uid()` folder can upload.
- **Delete Policy**: `Users Delete Own Attachments` — Only owner authenticated matching `auth.uid()` folder can delete.
