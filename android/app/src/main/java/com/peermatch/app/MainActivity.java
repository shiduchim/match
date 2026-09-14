package com.peermatch.app;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.res.ColorStateList;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.text.InputType;
import android.text.format.DateFormat;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import java.util.Date;
import java.util.List;

public class MainActivity extends Activity {
    private static final int BLUE = Color.rgb(49, 91, 120);
    private static final int GREEN = Color.rgb(65, 112, 90);
    private static final int BG = Color.rgb(246, 245, 242);
    private static final int CARD = Color.WHITE;
    private static final int OUTGOING = Color.rgb(225, 237, 246);

    private PeerMatchDb db;
    private LinearLayout content;
    private String screen = "home";
    private long openShadchanId = -1;
    private String pendingSharedText;

    private final BroadcastReceiver dataChanged = new BroadcastReceiver() {
        @Override public void onReceive(Context context, Intent intent) {
            refreshCurrent();
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        db = new PeerMatchDb(this);
        buildShell();
        registerDataReceiver();
        readShareIntent(getIntent());
        showHome();
        if (pendingSharedText != null) content.post(this::importSharedText);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        readShareIntent(intent);
        if (pendingSharedText != null) importSharedText();
    }

    @Override
    protected void onResume() {
        super.onResume();
        refreshCurrent();
    }

    @Override
    protected void onDestroy() {
        try { unregisterReceiver(dataChanged); } catch (Exception ignored) {}
        db.close();
        super.onDestroy();
    }

    private void registerDataReceiver() {
        IntentFilter f = new IntentFilter(WhatsAppNotificationService.ACTION_DATA_CHANGED);
        if (Build.VERSION.SDK_INT >= 33) registerReceiver(dataChanged, f, Context.RECEIVER_NOT_EXPORTED);
        else registerReceiver(dataChanged, f);
    }

    private void buildShell() {
        getWindow().setStatusBarColor(BG);
        getWindow().setNavigationBarColor(BG);

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(BG);

        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        content.setPadding(dp(16), dp(18), dp(16), dp(28));
        scroll.addView(content, new ScrollView.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        root.addView(scroll, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, 0, 1));
        setContentView(root);
    }

    private void showHome() {
        screen = "home";
        openShadchanId = -1;
        content.removeAllViews();

        TextView title = text("PeerMatch", 28, true);
        content.addView(title);
        TextView sub = text("Your private shidduch WhatsApp tracker", 14, false);
        sub.setTextColor(Color.DKGRAY);
        addWithMargin(sub, 0, 2, 0, 14);

        if (!notificationAccessEnabled()) {
            LinearLayout notice = cardLayout(Color.rgb(255, 248, 224));
            notice.addView(text("Enable WhatsApp tracking once", 17, true));
            TextView t = text("PeerMatch can copy WhatsApp reply notifications into the correct shadchan timeline. This stays on your phone.", 14, false);
            addWithMarginTo(notice, t, 0, 5, 0, 8);
            Button enable = button("Enable WhatsApp tracking", BLUE);
            enable.setOnClickListener(v -> startActivity(new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)));
            notice.addView(enable);
            addWithMargin(notice, 0, 0, 0, 14);
        }

        LinearLayout actions = new LinearLayout(this);
        actions.setOrientation(LinearLayout.HORIZONTAL);
        Button add = button("Add shadchan", BLUE);
        Button inbox = button("Unmatched replies", GREEN);
        add.setOnClickListener(v -> addShadchanDialog());
        inbox.setOnClickListener(v -> showInbox());
        actions.addView(add, new LinearLayout.LayoutParams(0, dp(48), 1));
        LinearLayout.LayoutParams ip = new LinearLayout.LayoutParams(0, dp(48), 1);
        ip.setMargins(dp(8), 0, 0, 0);
        actions.addView(inbox, ip);
        addWithMargin(actions, 0, 0, 0, 16);

        List<PeerMatchDb.Shadchan> shadchanim = db.getShadchanim();
        if (shadchanim.isEmpty()) {
            TextView empty = text("Add your first shadchan. Use the same name WhatsApp shows in notifications so replies can match automatically.", 15, false);
            empty.setTextColor(Color.DKGRAY);
            content.addView(empty);
            return;
        }

        for (PeerMatchDb.Shadchan s : shadchanim) {
            LinearLayout row = cardLayout(CARD);
            row.setClickable(true);
            row.setFocusable(true);
            row.setOnClickListener(v -> showShadchan(s.id));
            row.addView(text(s.name, 18, true));
            String detail = (s.status == null ? "New" : s.status);
            if (s.phone != null && !s.phone.isEmpty()) detail += "  •  " + s.phone;
            TextView d = text(detail, 13, false);
            d.setTextColor(Color.DKGRAY);
            addWithMarginTo(row, d, 0, 4, 0, 0);
            addWithMargin(row, 0, 0, 0, 9);
        }
    }

    private void showShadchan(long id) {
        PeerMatchDb.Shadchan s = db.getShadchan(id);
        if (s == null) { showHome(); return; }
        screen = "detail";
        openShadchanId = id;
        content.removeAllViews();

        Button back = smallButton("‹ Shadchanim");
        back.setOnClickListener(v -> showHome());
        content.addView(back);
        addWithMargin(text(s.name, 27, true), 0, 10, 0, 2);

        Button status = smallButton("Status: " + s.status);
        status.setOnClickListener(v -> chooseStatus(s));
        addWithMargin(status, 0, 3, 0, 14);

        List<PeerMatchDb.Message> messages = db.getMessages(id);
        if (messages.isEmpty()) {
            TextView empty = text("No conversation saved yet. Messages you start here are logged before WhatsApp opens. Incoming WhatsApp notifications are added automatically when Android provides them.", 14, false);
            empty.setTextColor(Color.DKGRAY);
            addWithMargin(empty, 0, 0, 0, 14);
        } else {
            for (PeerMatchDb.Message m : messages) addMessageBubble(m);
        }

        TextView label = text("Message this shadchan", 15, true);
        addWithMargin(label, 0, 15, 0, 5);
        EditText message = new EditText(this);
        message.setHint("Type your WhatsApp message…");
        message.setMinLines(2);
        message.setMaxLines(6);
        message.setGravity(Gravity.TOP | Gravity.START);
        message.setBackground(cardBackground(Color.WHITE, 12));
        message.setPadding(dp(12), dp(10), dp(12), dp(10));
        content.addView(message, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        Button send = button("Send with WhatsApp", GREEN);
        send.setOnClickListener(v -> {
            String body = message.getText().toString().trim();
            if (body.isEmpty()) { toast("Type a message first."); return; }
            PeerMatchDb.Shadchan latest = db.getShadchan(id);
            if (latest == null || latest.phone == null || latest.phone.trim().isEmpty()) {
                toast("Add a phone number for this shadchan first.");
                return;
            }
            db.insertMessage(id, "outgoing", body, System.currentTimeMillis(), "peermatch", "You", null);
            if ("New".equals(latest.status) || "Contacted".equals(latest.status) || "Suggested".equals(latest.status)) {
                db.updateStatus(id, "Waiting");
            }
            openWhatsApp(latest.phone, body);
            message.setText("");
            showShadchan(id);
        });
        addWithMargin(send, 0, 8, 0, 8);

        TextView note = text("PeerMatch records the message when you tap above. WhatsApp opens with it filled in; you make the final Send tap in WhatsApp.", 12, false);
        note.setTextColor(Color.GRAY);
        content.addView(note);
    }

    private void addMessageBubble(PeerMatchDb.Message m) {
        boolean outgoing = "outgoing".equals(m.direction);
        LinearLayout bubble = cardLayout(outgoing ? OUTGOING : CARD);
        String who = outgoing ? "You" : ((m.senderName == null || m.senderName.isEmpty()) ? "WhatsApp" : m.senderName);
        TextView top = text(who + "  •  " + formatTime(m.ts), 12, true);
        top.setTextColor(outgoing ? BLUE : Color.DKGRAY);
        bubble.addView(top);
        addWithMarginTo(bubble, text(m.body, 16, false), 0, 5, 0, 0);
        addWithMargin(bubble, outgoing ? 38 : 0, 0, outgoing ? 0 : 38, 7);
    }

    private void showInbox() {
        screen = "inbox";
        openShadchanId = -1;
        content.removeAllViews();
        Button back = smallButton("‹ Shadchanim");
        back.setOnClickListener(v -> showHome());
        content.addView(back);
        addWithMargin(text("Unmatched replies", 26, true), 0, 10, 0, 4);
        TextView help = text("If PeerMatch cannot match a WhatsApp notification to a saved shadchan name, it lands here. Tap Assign once; future messages with that WhatsApp name can be matched automatically by adding that name to the contact.", 13, false);
        help.setTextColor(Color.DKGRAY);
        addWithMargin(help, 0, 0, 0, 14);

        List<PeerMatchDb.Message> items = db.getUnmatchedMessages();
        if (items.isEmpty()) {
            content.addView(text("No unmatched WhatsApp replies.", 15, false));
            return;
        }
        for (PeerMatchDb.Message m : items) {
            LinearLayout card = cardLayout(CARD);
            card.addView(text((m.senderName == null || m.senderName.isEmpty()) ? "Unknown WhatsApp sender" : m.senderName, 17, true));
            TextView time = text(formatTime(m.ts), 12, false);
            time.setTextColor(Color.GRAY);
            card.addView(time);
            addWithMarginTo(card, text(m.body, 15, false), 0, 6, 0, 7);
            Button assign = button("Assign to shadchan", BLUE);
            assign.setOnClickListener(v -> chooseShadchanForMessage(m.id));
            card.addView(assign);
            addWithMargin(card, 0, 0, 0, 9);
        }
    }

    private void chooseShadchanForMessage(long messageId) {
        List<PeerMatchDb.Shadchan> list = db.getShadchanim();
        if (list.isEmpty()) { toast("Add a shadchan first."); return; }
        String[] names = new String[list.size()];
        for (int i = 0; i < list.size(); i++) names[i] = list.get(i).name;
        new AlertDialog.Builder(this)
                .setTitle("Assign reply to")
                .setItems(names, (d, which) -> {
                    long sid = list.get(which).id;
                    db.assignMessage(messageId, sid);
                    showShadchan(sid);
                })
                .setNegativeButton("Cancel", null)
                .show();
    }

    private void addShadchanDialog() {
        LinearLayout form = new LinearLayout(this);
        form.setOrientation(LinearLayout.VERTICAL);
        form.setPadding(dp(20), dp(4), dp(20), 0);
        EditText name = field("Name");
        EditText phone = field("Phone, e.g. +972…");
        phone.setInputType(InputType.TYPE_CLASS_PHONE);
        EditText waName = field("WhatsApp display name (optional)");
        form.addView(name);
        form.addView(phone);
        form.addView(waName);

        AlertDialog dialog = new AlertDialog.Builder(this)
                .setTitle("Add shadchan")
                .setView(form)
                .setPositiveButton("Save", null)
                .setNegativeButton("Cancel", null)
                .create();
        dialog.setOnShowListener(x -> dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v -> {
            String n = name.getText().toString().trim();
            if (n.isEmpty()) { name.setError("Name required"); return; }
            long id = db.addShadchan(n, phone.getText().toString(), waName.getText().toString());
            dialog.dismiss();
            showShadchan(id);
        }));
        dialog.show();
    }

    private void chooseStatus(PeerMatchDb.Shadchan s) {
        String[] statuses = {"New", "Contacted", "Waiting", "Suggested", "In progress", "Closed"};
        new AlertDialog.Builder(this)
                .setTitle("Shidduch status")
                .setItems(statuses, (d, which) -> {
                    db.updateStatus(s.id, statuses[which]);
                    showShadchan(s.id);
                })
                .setNegativeButton("Cancel", null)
                .show();
    }

    private void readShareIntent(Intent intent) {
        if (intent == null || !Intent.ACTION_SEND.equals(intent.getAction())) return;
        if (!"text/plain".equals(intent.getType())) return;
        CharSequence x = intent.getCharSequenceExtra(Intent.EXTRA_TEXT);
        if (x != null && !x.toString().trim().isEmpty()) pendingSharedText = x.toString().trim();
    }

    private void importSharedText() {
        String shared = pendingSharedText;
        pendingSharedText = null;
        if (shared == null || shared.isEmpty()) return;
        List<PeerMatchDb.Shadchan> list = db.getShadchanim();
        if (list.isEmpty()) {
            new AlertDialog.Builder(this)
                    .setTitle("Shared WhatsApp text received")
                    .setMessage("Add a shadchan first, then share the message to PeerMatch again.")
                    .setPositiveButton("OK", null).show();
            return;
        }
        String[] names = new String[list.size()];
        for (int i = 0; i < list.size(); i++) names[i] = list.get(i).name;
        new AlertDialog.Builder(this)
                .setTitle("Save shared reply under")
                .setMessage(shared)
                .setItems(names, (d, which) -> {
                    long sid = list.get(which).id;
                    db.insertMessage(sid, "incoming", shared, System.currentTimeMillis(), "android_share", "Shared from WhatsApp", null);
                    showShadchan(sid);
                })
                .setNegativeButton("Cancel", null)
                .show();
    }

    private void openWhatsApp(String phone, String body) {
        String digits = normalizePhone(phone);
        if (digits.isEmpty()) { toast("Phone number is not valid."); return; }
        Uri uri = Uri.parse("https://wa.me/" + digits + "?text=" + Uri.encode(body));
        if (tryOpen(uri, "com.whatsapp")) return;
        if (tryOpen(uri, "com.whatsapp.w4b")) return;
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, uri));
        } catch (ActivityNotFoundException e) {
            toast("WhatsApp could not be opened.");
        }
    }

    private boolean tryOpen(Uri uri, String pkg) {
        try {
            Intent i = new Intent(Intent.ACTION_VIEW, uri);
            i.setPackage(pkg);
            startActivity(i);
            return true;
        } catch (ActivityNotFoundException e) {
            return false;
        }
    }

    private String normalizePhone(String raw) {
        if (raw == null) return "";
        String trimmed = raw.trim();
        String digits = trimmed.replaceAll("\\D", "");
        if (digits.startsWith("00")) digits = digits.substring(2);
        if (!trimmed.startsWith("+") && digits.startsWith("0") && digits.length() >= 9) {
            digits = "972" + digits.substring(1);
        }
        return digits;
    }

    private boolean notificationAccessEnabled() {
        String enabled = Settings.Secure.getString(getContentResolver(), "enabled_notification_listeners");
        return enabled != null && enabled.contains(getPackageName());
    }

    private void refreshCurrent() {
        if (content == null) return;
        if ("detail".equals(screen) && openShadchanId > 0) showShadchan(openShadchanId);
        else if ("inbox".equals(screen)) showInbox();
        else showHome();
    }

    private EditText field(String hint) {
        EditText e = new EditText(this);
        e.setHint(hint);
        e.setSingleLine(true);
        return e;
    }

    private TextView text(String value, int sp, boolean bold) {
        TextView t = new TextView(this);
        t.setText(value);
        t.setTextSize(sp);
        t.setTextColor(Color.rgb(35, 39, 42));
        if (bold) t.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        t.setLineSpacing(0, 1.08f);
        return t;
    }

    private Button button(String label, int color) {
        Button b = new Button(this);
        b.setText(label);
        b.setTextColor(Color.WHITE);
        b.setTextSize(14);
        b.setAllCaps(false);
        b.setBackgroundTintList(ColorStateList.valueOf(color));
        return b;
    }

    private Button smallButton(String label) {
        Button b = new Button(this);
        b.setText(label);
        b.setAllCaps(false);
        b.setTextColor(BLUE);
        b.setTextSize(14);
        b.setBackgroundTintList(ColorStateList.valueOf(Color.TRANSPARENT));
        b.setGravity(Gravity.START | Gravity.CENTER_VERTICAL);
        b.setPadding(0, 0, 0, 0);
        return b;
    }

    private LinearLayout cardLayout(int color) {
        LinearLayout x = new LinearLayout(this);
        x.setOrientation(LinearLayout.VERTICAL);
        x.setPadding(dp(13), dp(11), dp(13), dp(11));
        x.setBackground(cardBackground(color, 12));
        return x;
    }

    private GradientDrawable cardBackground(int color, int radiusDp) {
        GradientDrawable g = new GradientDrawable();
        g.setColor(color);
        g.setCornerRadius(dp(radiusDp));
        return g;
    }

    private void addWithMargin(View v, int left, int top, int right, int bottom) {
        LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        p.setMargins(dp(left), dp(top), dp(right), dp(bottom));
        content.addView(v, p);
    }

    private void addWithMarginTo(LinearLayout parent, View v, int left, int top, int right, int bottom) {
        LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        p.setMargins(dp(left), dp(top), dp(right), dp(bottom));
        parent.addView(v, p);
    }

    private String formatTime(long ts) {
        return DateFormat.getMediumDateFormat(this).format(new Date(ts)) + " " +
                DateFormat.getTimeFormat(this).format(new Date(ts));
    }

    private int dp(int x) {
        return Math.round(x * getResources().getDisplayMetrics().density);
    }

    private void toast(String s) {
        Toast.makeText(this, s, Toast.LENGTH_SHORT).show();
    }
}
