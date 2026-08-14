package com.qrstack.agent;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.net.Uri;
import android.os.Build;
import android.provider.MediaStore;

import java.io.IOException;
import java.io.OutputStream;

final class MediaStoreHelper {
    private MediaStoreHelper() {
    }

    static Uri saveStory(Context context, StoryJob job, byte[] bytes) throws IOException {
        ContentResolver resolver = context.getContentResolver();
        ContentValues values = new ContentValues();
        values.put(MediaStore.Images.Media.DISPLAY_NAME, "qrstack-" + job.restaurantSlug + "-" + job.id + ".png");
        values.put(MediaStore.Images.Media.MIME_TYPE, "image/png");
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            values.put(MediaStore.Images.Media.RELATIVE_PATH, "Pictures/QrStack");
            values.put(MediaStore.Images.Media.IS_PENDING, 1);
        }
        Uri uri = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);
        if (uri == null) throw new IOException("Não foi possível criar a arte na galeria");
        try (OutputStream output = resolver.openOutputStream(uri)) {
            if (output == null) throw new IOException("Não foi possível abrir a arte na galeria");
            output.write(bytes);
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ContentValues ready = new ContentValues();
            ready.put(MediaStore.Images.Media.IS_PENDING, 0);
            resolver.update(uri, ready, null, null);
        }
        return uri;
    }
}
