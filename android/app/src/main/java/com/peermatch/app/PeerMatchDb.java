package com.peermatch.app;

import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

public class PeerMatchDb extends SQLiteOpenHelper {
    private static final String DB_NAME = "peermatch.db";
    private static final int DB_VERSION = 1;

    public static class Shadchan {
        public long id;
        public String name;
        public String phone;
        public String whatsappName;
        public String status;
    }

    public static class Message {
        public long id;
        public Long shadchanId;
        public String direction;
        public String body;
        public long ts;
        public String source;
        public String senderName;
    }

    public PeerMatchDb(Context context) {
        super(context, DB_NAME, null, DB_VERSION);
    }

    @Override
    public void onCreate(SQLiteDatabase db) {
        db.execSQL("CREATE TABLE shadchanim (" +
                "id INTEGER PRIMARY KEY AUTOINCREMENT," +
                "name TEXT NOT NULL," +
                "phone TEXT," +
                "whatsapp_name TEXT," +
                "status TEXT NOT NULL DEFAULT 'New'," +
                "created_at INTEGER NOT NULL)");
        db.execSQL("CREATE TABLE messages (" +
                "id INTEGER PRIMARY KEY AUTOINCREMENT," +
                "shadchan_id INTEGER," +
                "direction TEXT NOT NULL," +
                "body TEXT NOT NULL," +
                "ts INTEGER NOT NULL," +
                "source TEXT," +
                "sender_name TEXT," +
                "dedupe_key TEXT UNIQUE," +
                "FOREIGN KEY(shadchan_id) REFERENCES shadchanim(id))");
        db.execSQL("CREATE INDEX idx_messages_shadchan_ts ON messages(shadchan_id, ts)");
    }

    @Override
    public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) {
    }

    public long addShadchan(String name, String phone, String whatsappName) {
        ContentValues v = new ContentValues();
        v.put("name", name.trim());
        v.put("phone", phone == null ? "" : phone.trim());
        v.put("whatsapp_name", whatsappName == null ? "" : whatsappName.trim());
        v.put("status", "New");
        v.put("created_at", System.currentTimeMillis());
        return getWritableDatabase().insertOrThrow("shadchanim", null, v);
    }

    public List<Shadchan> getShadchanim() {
        List<Shadchan> out = new ArrayList<>();
        Cursor c = getReadableDatabase().rawQuery(
                "SELECT id,name,phone,whatsapp_name,status FROM shadchanim ORDER BY name COLLATE NOCASE", null);
        try {
            while (c.moveToNext()) out.add(readShadchan(c));
        } finally {
            c.close();
        }
        return out;
    }

    public Shadchan getShadchan(long id) {
        Cursor c = getReadableDatabase().rawQuery(
                "SELECT id,name,phone,whatsapp_name,status FROM shadchanim WHERE id=?",
                new String[]{String.valueOf(id)});
        try {
            return c.moveToFirst() ? readShadchan(c) : null;
        } finally {
            c.close();
        }
    }

    private Shadchan readShadchan(Cursor c) {
        Shadchan s = new Shadchan();
        s.id = c.getLong(0);
        s.name = c.getString(1);
        s.phone = c.getString(2);
        s.whatsappName = c.getString(3);
        s.status = c.getString(4);
        return s;
    }

    public void updateStatus(long id, String status) {
        ContentValues v = new ContentValues();
        v.put("status", status);
        getWritableDatabase().update("shadchanim", v, "id=?", new String[]{String.valueOf(id)});
    }

    public long findShadchanIdBySender(String sender) {
        String n = norm(sender);
        if (n.isEmpty()) return -1;
        for (Shadchan s : getShadchanim()) {
            if (n.equals(norm(s.name)) || (!norm(s.whatsappName).isEmpty() && n.equals(norm(s.whatsappName)))) {
                return s.id;
            }
        }
        return -1;
    }

    public boolean insertMessage(Long shadchanId, String direction, String body, long ts,
                                 String source, String senderName, String dedupeKey) {
        if (body == null || body.trim().isEmpty()) return false;
        ContentValues v = new ContentValues();
        if (shadchanId == null || shadchanId <= 0) v.putNull("shadchan_id"); else v.put("shadchan_id", shadchanId);
        v.put("direction", direction);
        v.put("body", body.trim());
        v.put("ts", ts);
        v.put("source", source == null ? "" : source);
        v.put("sender_name", senderName == null ? "" : senderName);
        if (dedupeKey == null || dedupeKey.isEmpty()) v.putNull("dedupe_key"); else v.put("dedupe_key", dedupeKey);
        long id = getWritableDatabase().insertWithOnConflict("messages", null, v, SQLiteDatabase.CONFLICT_IGNORE);
        return id != -1;
    }

    public List<Message> getMessages(long shadchanId) {
        return readMessages("WHERE shadchan_id=? ORDER BY ts ASC, id ASC", new String[]{String.valueOf(shadchanId)});
    }

    public List<Message> getUnmatchedMessages() {
        return readMessages("WHERE shadchan_id IS NULL ORDER BY ts DESC, id DESC", null);
    }

    private List<Message> readMessages(String tail, String[] args) {
        List<Message> out = new ArrayList<>();
        Cursor c = getReadableDatabase().rawQuery(
                "SELECT id,shadchan_id,direction,body,ts,source,sender_name FROM messages " + tail, args);
        try {
            while (c.moveToNext()) {
                Message m = new Message();
                m.id = c.getLong(0);
                m.shadchanId = c.isNull(1) ? null : c.getLong(1);
                m.direction = c.getString(2);
                m.body = c.getString(3);
                m.ts = c.getLong(4);
                m.source = c.getString(5);
                m.senderName = c.getString(6);
                out.add(m);
            }
        } finally {
            c.close();
        }
        return out;
    }

    public void assignMessage(long messageId, long shadchanId) {
        ContentValues v = new ContentValues();
        v.put("shadchan_id", shadchanId);
        getWritableDatabase().update("messages", v, "id=?", new String[]{String.valueOf(messageId)});
    }

    public static String norm(String s) {
        if (s == null) return "";
        return s.trim().replaceAll("\\s+", " ").toLowerCase(Locale.ROOT);
    }
}
