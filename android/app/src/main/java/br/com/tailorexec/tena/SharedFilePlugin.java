package br.com.tailorexec.tena;

import android.content.ContentResolver;
import android.database.Cursor;
import android.net.Uri;
import android.provider.OpenableColumns;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;

/**
 * Recebe arquivos vindos do menu "Compartilhar" do Android (ACTION_SEND) e os
 * entrega para a camada web em base64.
 *
 * O app NAO grava a chamada: ele apenas importa um audio que outro app (discador
 * nativo, WhatsApp, gravador) ja gravou.
 */
@CapacitorPlugin(name = "SharedFile")
public class SharedFilePlugin extends Plugin {

    /** Limite alinhado ao MAX_VIDEO_MB / limite de audio do app. */
    private static final long MAX_BYTES = 25L * 1024 * 1024;

    private static Uri pendingUri;
    private static SharedFilePlugin instance;

    @Override
    public void load() {
        instance = this;
    }

    /** Chamado pela MainActivity quando chega um intent de compartilhamento. */
    static void setPending(Uri uri) {
        pendingUri = uri;
    }

    /** Avisa a camada web que ha um arquivo novo (app ja estava aberto). */
    static void notifyAvailable() {
        if (instance != null) {
            instance.notifyListeners("sharedFile", new JSObject());
        }
    }

    /** Entrega o arquivo pendente (e o consome). */
    @PluginMethod
    public void consume(PluginCall call) {
        Uri uri = pendingUri;
        pendingUri = null;

        JSObject ret = new JSObject();
        if (uri == null) {
            ret.put("empty", true);
            call.resolve(ret);
            return;
        }

        try {
            ContentResolver cr = getContext().getContentResolver();

            long size = querySize(cr, uri);
            if (size > MAX_BYTES) {
                call.reject("too_large");
                return;
            }

            byte[] bytes = readAll(cr, uri);
            if (bytes == null) {
                call.reject("read_failed");
                return;
            }
            if (bytes.length > MAX_BYTES) {
                call.reject("too_large");
                return;
            }

            String name = queryName(cr, uri);
            String mime = cr.getType(uri);

            ret.put("empty", false);
            ret.put("name", name != null ? name : "audio");
            ret.put("mimeType", mime != null ? mime : "application/octet-stream");
            ret.put("size", bytes.length);
            ret.put("data", Base64.encodeToString(bytes, Base64.NO_WRAP));
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("read_failed: " + e.getMessage());
        }
    }

    private String queryName(ContentResolver cr, Uri uri) {
        try (Cursor c = cr.query(uri, null, null, null, null)) {
            if (c != null && c.moveToFirst()) {
                int i = c.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                if (i >= 0) return c.getString(i);
            }
        } catch (Exception ignored) {
        }
        return null;
    }

    /** -1 quando desconhecido (nao bloqueia; o tamanho real e checado apos ler). */
    private long querySize(ContentResolver cr, Uri uri) {
        try (Cursor c = cr.query(uri, null, null, null, null)) {
            if (c != null && c.moveToFirst()) {
                int i = c.getColumnIndex(OpenableColumns.SIZE);
                if (i >= 0 && !c.isNull(i)) return c.getLong(i);
            }
        } catch (Exception ignored) {
        }
        return -1;
    }

    private byte[] readAll(ContentResolver cr, Uri uri) throws Exception {
        try (InputStream in = cr.openInputStream(uri)) {
            if (in == null) return null;
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            int n;
            long total = 0;
            while ((n = in.read(buf)) != -1) {
                total += n;
                if (total > MAX_BYTES) return null;
                out.write(buf, 0, n);
            }
            return out.toByteArray();
        }
    }
}
