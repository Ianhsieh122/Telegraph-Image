export async function onRequestPost(context) {
    try {
        const { request, env } = context;
        const formData = await request.formData();
        const file = formData.get('file');

        if (!file) {
            return new Response(JSON.stringify({
                success: false,
                message: 'No file provided'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Check file size (2GB limit)
        const maxSize = 2 * 1024 * 1024 * 1024; // 2GB
        if (file.size > maxSize) {
            return new Response(JSON.stringify({
                success: false,
                message: 'File size exceeds 2GB limit'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Upload to Telegram
        const telegramResponse = await uploadToTelegram(file, env);
        
        if (telegramResponse.success) {
            return new Response(JSON.stringify({
                success: true,
                url: telegramResponse.url,
                message: 'File uploaded successfully'
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        } else {
            throw new Error(telegramResponse.message || 'Upload failed');
        }

    } catch (error) {
        console.error('Upload error:', error);
        return new Response(JSON.stringify({
            success: false,
            message: error.message || 'Internal server error'
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

async function uploadToTelegram(file, env) {
    try {
        const botToken = env.TG_Bot_Token;
        const chatId = env.TG_Chat_ID;

        if (!botToken || !chatId) {
            throw new Error('Telegram credentials not configured');
        }

        const formData = new FormData();
        formData.append('chat_id', chatId);
        formData.append('document', file);

        const response = await fetch(`https://api.telegram.org/bot${botToken}/sendDocument`, {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (result.ok && result.result.document) {
            // Get file_id from Telegram response
            const fileId = result.result.document.file_id;
            
            // Get file info to construct download URL
            const fileInfoResponse = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`);
            const fileInfo = await fileInfoResponse.json();
            
            if (fileInfo.ok) {
                const filePath = fileInfo.result.file_path;
                const downloadUrl = `https://api.telegram.org/file/bot${botToken}/${filePath}`;
                
                return {
                    success: true,
                    url: downloadUrl
                };
            } else {
                throw new Error('Failed to get file info from Telegram');
            }
        } else {
            throw new Error(result.description || 'Failed to upload to Telegram');
        }

    } catch (error) {
        console.error('Telegram upload error:', error);
        return {
            success: false,
            message: error.message || 'Telegram upload failed'
        };
    }
}
