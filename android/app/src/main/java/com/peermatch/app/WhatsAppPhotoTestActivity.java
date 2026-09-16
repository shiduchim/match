package com.peermatch.app;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.ComponentName;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.text.InputType;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

public class WhatsAppPhotoTestActivity extends Activity {
    private static final int PICK_IMAGE = 4201;
    private Uri imageUri;
    private TextView status;
    private EditText phone;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        ScrollView scroll = new ScrollView(this);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(18), dp(22), dp(18), dp(24));
        scroll.addView(root, new ScrollView.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        TextView title = new TextView(this);
        title.setText("PeerMatch WhatsApp Photo Test");
        title.setTextSize(24);
        root.addView(title);

        TextView help = new TextView(this);
        help.setText("This is an isolated experiment. Pick any image, enter a WhatsApp phone number, then try A and B. Success means WhatsApp opens that exact chat with BOTH the image attached and the test text filled in. C is the known baseline and should open WhatsApp's contact picker with the image + text.");
        help.setTextSize(15);
        add(root, help, 0, 10, 0, 18);

        phone = new EditText(this);
        phone.setHint("Recipient phone, e.g. +972501234567");
        phone.setInputType(InputType.TYPE_CLASS_PHONE);
        root.addView(phone);

        Button choose = new Button(this);
        choose.setText("1. Choose test image");
        choose.setAllCaps(false);
        choose.setOnClickListener(v -> chooseImage());
        add(root, choose, 0, 10, 0, 8);

        status = new TextView(this);
        status.setText("No image selected yet.");
        status.setTextSize(14);
        add(root, status, 0, 0, 0, 18);

        Button testA = new Button(this);
        testA.setText("2A. Test package + jid");
        testA.setAllCaps(false);
        testA.setOnClickListener(v -> sendTargeted(false));
        root.addView(testA);

        TextView a = new TextView(this);
        a.setText("ACTION_SEND + image + text + WhatsApp package + undocumented jid extra.");
        add(root, a, 0, 2, 0, 12);

        Button testB = new Button(this);
        testB.setText("2B. Test ContactPicker + jid");
        testB.setAllCaps(false);
        testB.setOnClickListener(v -> sendTargeted(true));
        root.addView(testB);

        TextView b = new TextView(this);
        b.setText("Same payload, but explicitly targets WhatsApp's old internal ContactPicker component. This may fail if WhatsApp renamed or blocks that component.");
        add(root, b, 0, 2, 0, 12);

        Button baseline = new Button(this);
        baseline.setText("2C. Baseline: image + text, choose recipient");
        baseline.setAllCaps(false);
        baseline.setOnClickListener(v -> sendBaseline());
        root.addView(baseline);

        TextView c = new TextView(this);
        c.setText("Known-supported behavior: image + text goes to WhatsApp, but WhatsApp chooses the recipient manually.");
        add(root, c, 0, 2, 0, 12);

        TextView result = new TextView(this);
        result.setText("How to report the result:\nA = exact chat + image + text / picker / failed\nB = exact chat + image + text / picker / failed\nC = image + text present? yes/no");
        result.setTextSize(15);
        add(root, result, 0, 14, 0, 0);

        setContentView(scroll);
    }

    private void chooseImage() {
        Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        i.addCategory(Intent.CATEGORY_OPENABLE);
        i.setType("image/*");
        startActivityForResult(i, PICK_IMAGE);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != PICK_IMAGE || resultCode != RESULT_OK || data == null || data.getData() == null) return;
        imageUri = data.getData();
        try {
            int flags = data.getFlags() & (Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
            getContentResolver().takePersistableUriPermission(imageUri, flags);
        } catch (Exception ignored) {}
        status.setText("Image selected: " + imageUri);
    }

    private void sendTargeted(boolean explicitContactPicker) {
        String digits = normalizePhone(phone.getText().toString());
        if (digits.isEmpty()) { toast("Enter a valid phone number first."); return; }
        if (imageUri == null) { toast("Choose an image first."); return; }

        Intent send = buildImageIntent();
        send.putExtra("jid", digits + "@s.whatsapp.net");
        if (explicitContactPicker) {
            send.setComponent(new ComponentName("com.whatsapp", "com.whatsapp.ContactPicker"));
        } else {
            send.setPackage("com.whatsapp");
        }

        try {
            startActivity(send);
        } catch (ActivityNotFoundException | SecurityException e) {
            toast(explicitContactPicker
                    ? "Test B failed to open WhatsApp ContactPicker."
                    : "Test A failed to open WhatsApp.");
        }
    }

    private void sendBaseline() {
        if (imageUri == null) { toast("Choose an image first."); return; }
        Intent send = buildImageIntent();
        send.setPackage("com.whatsapp");
        try {
            startActivity(send);
        } catch (ActivityNotFoundException e) {
            toast("WhatsApp could not be opened.");
        }
    }

    private Intent buildImageIntent() {
        Intent send = new Intent(Intent.ACTION_SEND);
        send.setType("image/*");
        send.putExtra(Intent.EXTRA_STREAM, imageUri);
        send.putExtra(Intent.EXTRA_TEXT, "PeerMatch TEST — image + text + exact-recipient experiment");
        send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        send.setClipData(ClipData.newRawUri("PeerMatch test image", imageUri));
        return send;
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

    private void add(LinearLayout parent, android.view.View v, int l, int t, int r, int b) {
        LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        p.setMargins(dp(l), dp(t), dp(r), dp(b));
        parent.addView(v, p);
    }

    private int dp(int x) {
        return Math.round(x * getResources().getDisplayMetrics().density);
    }

    private void toast(String s) {
        Toast.makeText(this, s, Toast.LENGTH_LONG).show();
    }
}
