package br.com.tailorexec.tena;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;

/**
 * Servico em primeiro plano que mantem o microfone ativo com a tela apagada.
 *
 * A partir do Android 14 (API 34) so e possivel capturar audio em segundo plano
 * enquanto existe um foreground service do tipo "microphone". Este servico nao
 * grava nada: ele apenas segura o direito de usar o microfone. Quem grava e o
 * MediaRecorder do BgRecorderPlugin, no mesmo processo.
 */
public class RecorderService extends Service {

    private static final String CHANNEL_ID = "ana_recording";
    private static final int NOTIF_ID = 1001;

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        createChannel();

        Intent open = new Intent(this, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_NEW_TASK);
        PendingIntent pi = PendingIntent.getActivity(
                this, 0, open, PendingIntent.FLAG_IMMUTABLE);

        Notification n = new Notification.Builder(this, CHANNEL_ID)
                .setContentTitle("ANA está gravando")
                .setContentText("A gravação continua com a tela apagada. Toque para voltar.")
                .setSmallIcon(android.R.drawable.presence_audio_online)
                .setContentIntent(pi)
                .setOngoing(true)
                .build();

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(NOTIF_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE);
        } else {
            startForeground(NOTIF_ID, n);
        }
        return START_STICKY;
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null && nm.getNotificationChannel(CHANNEL_ID) == null) {
                NotificationChannel ch = new NotificationChannel(
                        CHANNEL_ID, "Gravação", NotificationManager.IMPORTANCE_LOW);
                ch.setDescription("Aviso enquanto o ANA está gravando.");
                ch.setShowBadge(false);
                nm.createNotificationChannel(ch);
            }
        }
    }

    static void start(Context ctx) {
        Intent i = new Intent(ctx, RecorderService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            ctx.startForegroundService(i);
        } else {
            ctx.startService(i);
        }
    }

    static void stop(Context ctx) {
        ctx.stopService(new Intent(ctx, RecorderService.class));
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
