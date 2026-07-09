package br.com.tailorexec.tena;

import android.Manifest;
import android.media.MediaRecorder;
import android.os.Build;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.File;
import java.io.RandomAccessFile;

/**
 * Gravacao por microfone que sobrevive a tela apagada.
 *
 * Grava AAC/m4a via MediaRecorder, com um foreground service do tipo "microphone"
 * segurando o direito de capturar audio em segundo plano (obrigatorio no Android 14+).
 *
 * O arquivo NAO e devolvido de uma vez: a camada web le em pedacos (readChunk) e monta
 * um Blob. Uma gravacao de 1h tem ~15 MB; em base64 unico isso derrubaria aparelhos fracos.
 */
@CapacitorPlugin(
        name = "BgRecorder",
        permissions = {
                @Permission(alias = "microphone", strings = { Manifest.permission.RECORD_AUDIO }),
                @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS })
        }
)
public class BgRecorderPlugin extends Plugin {

    private MediaRecorder recorder;
    private File outFile;
    private boolean paused = false;
    private long startedAt = 0;
    private long pausedAccum = 0;
    private long pausedAt = 0;

    @PluginMethod
    public void start(PluginCall call) {
        if (getPermissionState("microphone") != com.getcapacitor.PermissionState.GRANTED) {
            requestPermissionForAlias("microphone", call, "afterMicPermission");
            return;
        }
        doStart(call);
    }

    @PermissionCallback
    private void afterMicPermission(PluginCall call) {
        if (getPermissionState("microphone") != com.getcapacitor.PermissionState.GRANTED) {
            call.reject("permission_denied");
            return;
        }
        doStart(call);
    }

    private void doStart(PluginCall call) {
        if (recorder != null) {
            call.reject("already_recording");
            return;
        }
        try {
            outFile = new File(getContext().getCacheDir(), "ana_rec_" + System.currentTimeMillis() + ".m4a");

            recorder = (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S)
                    ? new MediaRecorder(getContext())
                    : new MediaRecorder();
            recorder.setAudioSource(MediaRecorder.AudioSource.MIC);
            recorder.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4);
            recorder.setAudioEncoder(MediaRecorder.AudioEncoder.AAC);
            recorder.setAudioChannels(1);
            recorder.setAudioSamplingRate(44100);
            recorder.setAudioEncodingBitRate(48000); // ~21 MB/h, bom para fala
            recorder.setOutputFile(outFile.getAbsolutePath());
            recorder.prepare();

            // O servico precisa existir ANTES de comecar a capturar em background.
            RecorderService.start(getContext());
            recorder.start();

            startedAt = System.currentTimeMillis();
            pausedAccum = 0;
            paused = false;
            call.resolve();
        } catch (Exception e) {
            cleanup();
            call.reject("start_failed: " + e.getMessage());
        }
    }

    @PluginMethod
    public void pause(PluginCall call) {
        if (recorder == null || paused) { call.resolve(); return; }
        try {
            recorder.pause();
            paused = true;
            pausedAt = System.currentTimeMillis();
            call.resolve();
        } catch (Exception e) {
            call.reject("pause_failed: " + e.getMessage());
        }
    }

    @PluginMethod
    public void resume(PluginCall call) {
        if (recorder == null || !paused) { call.resolve(); return; }
        try {
            recorder.resume();
            pausedAccum += System.currentTimeMillis() - pausedAt;
            paused = false;
            call.resolve();
        } catch (Exception e) {
            call.reject("resume_failed: " + e.getMessage());
        }
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("recording", recorder != null);
        ret.put("paused", paused);
        ret.put("seconds", recorder == null ? 0 : elapsedSeconds());
        call.resolve(ret);
    }

    private long elapsedSeconds() {
        long now = paused ? pausedAt : System.currentTimeMillis();
        return Math.max(0, (now - startedAt - pausedAccum) / 1000);
    }

    /** Encerra e devolve metadados. O conteudo vem depois, por readChunk. */
    @PluginMethod
    public void stop(PluginCall call) {
        if (recorder == null) {
            call.reject("not_recording");
            return;
        }
        long secs = elapsedSeconds();
        try {
            recorder.stop();
        } catch (Exception ignored) {
            // stop() lanca se a gravacao durou menos que ~1s: o arquivo fica invalido
        } finally {
            cleanup();
        }

        if (outFile == null || !outFile.exists() || outFile.length() == 0) {
            call.reject("empty_recording");
            return;
        }

        JSObject ret = new JSObject();
        ret.put("path", outFile.getAbsolutePath());
        ret.put("size", outFile.length());
        ret.put("durationSeconds", secs);
        ret.put("mimeType", "audio/mp4");
        call.resolve(ret);
    }

    /** Le um pedaco do arquivo gravado, em base64. */
    @PluginMethod
    public void readChunk(PluginCall call) {
        String path = call.getString("path");
        Integer offset = call.getInt("offset", 0);
        Integer length = call.getInt("length", 1024 * 1024);
        if (path == null) { call.reject("missing_path"); return; }

        File f = new File(path);
        if (!f.exists()) { call.reject("not_found"); return; }

        try (RandomAccessFile raf = new RandomAccessFile(f, "r")) {
            raf.seek(offset);
            byte[] buf = new byte[length];
            int read = raf.read(buf);
            if (read <= 0) {
                JSObject ret = new JSObject();
                ret.put("data", "");
                ret.put("read", 0);
                call.resolve(ret);
                return;
            }
            byte[] slice = new byte[read];
            System.arraycopy(buf, 0, slice, 0, read);

            JSObject ret = new JSObject();
            ret.put("data", Base64.encodeToString(slice, Base64.NO_WRAP));
            ret.put("read", read);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("read_failed: " + e.getMessage());
        }
    }

    /** Apaga o arquivo temporario apos a web ter lido tudo. */
    @PluginMethod
    public void discard(PluginCall call) {
        String path = call.getString("path");
        if (path != null) {
            File f = new File(path);
            if (f.exists()) //noinspection ResultOfMethodCallIgnored
                f.delete();
        }
        call.resolve();
    }

    private void cleanup() {
        if (recorder != null) {
            try { recorder.release(); } catch (Exception ignored) {}
            recorder = null;
        }
        paused = false;
        RecorderService.stop(getContext());
    }

    @Override
    protected void handleOnDestroy() {
        cleanup();
        super.handleOnDestroy();
    }
}
