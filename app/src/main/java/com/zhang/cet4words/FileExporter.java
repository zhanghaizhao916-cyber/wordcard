package com.zhang.cet4words;

import android.content.ContentValues;
import android.content.Context;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.nio.charset.Charset;

/** 把备份 JSON 写到系统「下载」目录。 */
public final class FileExporter {

    private FileExporter() {
    }

    public static String save(Context ctx, String name, String content) {
        if (name == null || name.trim().isEmpty()) name = "cet4words-backup.json";
        name = name.replaceAll("[\\\\/:*?\"<>|]", "_");
        byte[] bytes = content.getBytes(Charset.forName("UTF-8"));

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentValues v = new ContentValues();
                v.put(MediaStore.MediaColumns.DISPLAY_NAME, name);
                v.put(MediaStore.MediaColumns.MIME_TYPE, "application/json");
                v.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
                Uri uri = ctx.getContentResolver()
                        .insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
                if (uri == null) return "err:cannot create entry";
                OutputStream os = ctx.getContentResolver().openOutputStream(uri);
                if (os == null) return "err:cannot open stream";
                os.write(bytes);
                os.flush();
                os.close();
                return "ok:Download/" + name;
            } else {
                File dir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                if (dir != null && !dir.exists()) dir.mkdirs();
                if (dir == null) return "err:no download dir";
                File f = new File(dir, name);
                FileOutputStream fos = new FileOutputStream(f);
                fos.write(bytes);
                fos.flush();
                fos.close();
                return "ok:" + f.getAbsolutePath();
            }
        } catch (Exception e) {
            return "err:" + e.getClass().getSimpleName() + " " + e.getMessage();
        }
    }
}
