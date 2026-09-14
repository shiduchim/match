package com.peermatch.app;

import android.app.Notification;
import android.app.Person;
import android.content.Intent;
import android.os.Bundle;
import android.os.Parcelable;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;

public class WhatsAppNotificationService extends NotificationListenerService {
    public static final String ACTION_DATA_CHANGED = "com.peermatch.app.DATA_CHANGED";

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        String pkg = sbn.getPackageName();
        if (!"com.whatsapp".equals(pkg) && !"com.whatsapp.w4b".equals(pkg)) return;

        Notification n = sbn.getNotification();
        if (n == null || (n.flags & Notification.FLAG_GROUP_SUMMARY) != 0) return;

        PeerMatchDb db = new PeerMatchDb(getApplicationContext());
        boolean inserted = false;
        Bundle extras = n.extras;

        Parcelable[] messageBundles = extras == null ? null : extras.getParcelableArray(Notification.EXTRA_MESSAGES);
        if (messageBundles != null && messageBundles.length > 0) {
            for (Parcelable p : messageBundles) {
                if (!(p instanceof Bundle)) continue;
                Bundle b = (Bundle) p;
                CharSequence textCs = b.getCharSequence("text");
                if (textCs == null || textCs.toString().trim().isEmpty()) continue;

                String sender = "";
                Parcelable senderParcelable = b.getParcelable("sender_person");
                if (senderParcelable instanceof Person) {
                    CharSequence name = ((Person) senderParcelable).getName();
                    if (name != null) sender = name.toString();
                }
                if (sender.isEmpty()) {
                    CharSequence legacySender = b.getCharSequence("sender");
                    if (legacySender != null) sender = legacySender.toString();
                }
                if (sender.isEmpty()) sender = title(extras);

                long ts = b.getLong("time", sbn.getPostTime());
                inserted |= save(db, sbn, sender, textCs.toString(), ts);
            }
        } else if (extras != null) {
            String sender = title(extras);
            CharSequence bodyCs = extras.getCharSequence(Notification.EXTRA_BIG_TEXT);
            if (bodyCs == null || bodyCs.toString().trim().isEmpty()) {
                bodyCs = extras.getCharSequence(Notification.EXTRA_TEXT);
            }
            if (bodyCs != null && !bodyCs.toString().trim().isEmpty()) {
                inserted = save(db, sbn, sender, bodyCs.toString(), sbn.getPostTime());
            }
        }

        if (inserted) {
            Intent i = new Intent(ACTION_DATA_CHANGED);
            i.setPackage(getPackageName());
            sendBroadcast(i);
        }
    }

    private boolean save(PeerMatchDb db, StatusBarNotification sbn, String sender, String body, long ts) {
        if (body == null || body.trim().isEmpty()) return false;
        long shadchanId = db.findShadchanIdBySender(sender);
        Long matched = shadchanId > 0 ? shadchanId : null;
        String key = sbn.getKey() + "|" + ts + "|" + sender + "|" + body;
        return db.insertMessage(matched, "incoming", body, ts,
                "whatsapp_notification", sender, key);
    }

    private String title(Bundle extras) {
        if (extras == null) return "WhatsApp";
        CharSequence title = extras.getCharSequence(Notification.EXTRA_TITLE);
        return title == null ? "WhatsApp" : title.toString();
    }
}
