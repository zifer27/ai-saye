// ============================================================
// ZYREX AI - FRONTEND SCRIPT (FULL VERSION)
// ============================================================

document.addEventListener('DOMContentLoaded', () => {

    // ============================================================
    // 🔥 KONFIGURASI - PASTIKAN URL BACKEND ANDA BENAR!
    // ============================================================
    
    const BACKEND_URL = 'http://szxennofficial.qoupayid.xyz:3529';
    
    console.log('🔗 Backend URL:', BACKEND_URL);

    // ============================================================
    // SYSTEM PROMPT
    // ============================================================
    const SYSTEM_PROMPT = `Kamu adalah Zyrex AI, asisten cerdas yang dibuat oleh Ziferr.

📌 ATURAN UTAMA:
1. FOKUS: Membantu SEMUA pertanyaan (bukan hanya coding)
2. Jika user meminta kode, berikan dalam format code block dengan nama bahasa
3. Jawab dengan ramah, informatif, dan detail
4. Gunakan bahasa Indonesia

💡 Contoh format kode:
\`\`\`python
print("Hello World")
\`\`\`

INGAT: Selalu gunakan code block untuk semua kode!`;

    // ============================================================
    // ELEMEN DOM
    // ============================================================
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('toggleSidebarBtn');
    const newChatBtn = document.getElementById('newChatBtn');
    const clearHistoryBtn = document.getElementById('clearHistoryBtn');
    const messagesEl = document.getElementById('messages');
    const userInput = document.getElementById('userInput');
    const sendBtn = document.getElementById('sendBtn');
    const voiceBtn = document.getElementById('voiceBtn');
    const themeToggle = document.getElementById('themeToggle');
    const historyList = document.getElementById('historyList');
    const modal = document.getElementById('codeModal');
    const modalCode = document.getElementById('modalCode');
    const closeModal = document.querySelector('.close-modal');
    const copyCodeBtn = document.getElementById('copyCodeBtn');

    // ============================================================
    // STATE
    // ============================================================
    let currentChatId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    let chats = JSON.parse(localStorage.getItem('zyrexChats')) || {};
    let isRecording = false;
    let mediaRecorder = null;
    let audioChunks = [];
    let isProcessing = false;

    // ============================================================
    // FUNGSI UTAMA
    // ============================================================

    function renderMessages(chatId) {
        const msgs = chats[chatId] || [];
        messagesEl.innerHTML = '';

        msgs.forEach((msg) => {
            const div = document.createElement('div');
            div.className = `message ${msg.role}`;

            const avatar = document.createElement('div');
            avatar.className = 'avatar';
            avatar.innerHTML = msg.role === 'user' ? '<i class="fas fa-user"></i>' : '<i class="fas fa-paw"></i>';

            const bubble = document.createElement('div');
            bubble.className = 'bubble';

            let content = msg.content;

            // Code block
            content = content.replace(/```(\w+)?\s*([\s\S]*?)```/g, (match, lang, code) => {
                const langLabel = lang ? lang.trim() : '';
                const cleanCode = code.trim();
                return `<pre><code class="lang-${langLabel}">${escapeHtml(cleanCode)}</code></pre>`;
            });

            // Inline code
            content = content.replace(/`([^`]+)`/g, '<code>$1</code>');

            // Bold
            content = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

            // Italic
            content = content.replace(/\*(.*?)\*/g, '<em>$1</em>');

            // Newline
            content = content.replace(/\n/g, '<br>');

            bubble.innerHTML = content;

            // Tombol speaker untuk AI
            if (msg.role === 'assistant' && msg.content !== '⏳ Mengetik...') {
                const speakBtn = document.createElement('button');
                speakBtn.className = 'speak-btn';
                speakBtn.innerHTML = '<i class="fas fa-volume-up"></i> Suara';
                speakBtn.dataset.text = msg.content;
                speakBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    speakText(msg.content);
                });
                bubble.appendChild(speakBtn);
            }

            div.appendChild(avatar);
            div.appendChild(bubble);
            messagesEl.appendChild(div);
        });

        const container = document.getElementById('chatContainer');
        container.scrollTop = container.scrollHeight;
        renderHistory();
    }

    function escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    }

    function renderHistory() {
        const keys = Object.keys(chats);
        historyList.innerHTML = '';

        if (keys.length === 0) {
            historyList.innerHTML = '<div style="padding: 12px 14px; color: #7f9bb3; font-size: 14px;">Belum ada chat</div>';
            return;
        }

        keys.slice().reverse().forEach(key => {
            const item = document.createElement('div');
            item.className = `history-item ${key === currentChatId ? 'active' : ''}`;
            const firstMsg = chats[key]?.find(m => m.role === 'user')?.content || 'Chat kosong';
            item.innerHTML = `<i class="fas fa-comment"></i> ${firstMsg.substring(0, 24)}${firstMsg.length > 24 ? '…' : ''}`;
            item.dataset.chatId = key;
            item.addEventListener('click', () => {
                currentChatId = key;
                renderMessages(currentChatId);
                if (window.innerWidth <= 700) sidebar.classList.remove('open');
            });
            historyList.appendChild(item);
        });
    }

    function saveChat(chatId, messages) {
        chats[chatId] = messages;
        localStorage.setItem('zyrexChats', JSON.stringify(chats));
        renderHistory();
    }

    function addMessage(role, content) {
        if (!chats[currentChatId]) chats[currentChatId] = [];
        chats[currentChatId].push({ role, content });
        saveChat(currentChatId, chats[currentChatId]);
        renderMessages(currentChatId);
    }

    // ============================================================
    // CEK KONEKSI KE BACKEND
    // ============================================================
    async function checkBackend() {
        try {
            console.log('🔍 Checking backend connection...');
            const response = await fetch(BACKEND_URL + '/health');
            if (response.ok) {
                const data = await response.json();
                console.log('✅ Backend connected:', data);
                return true;
            }
            return false;
        } catch (error) {
            console.error('❌ Backend error:', error.message);
            return false;
        }
    }

    // ============================================================
    // KIRIM PESAN KE AI
    // ============================================================
    async function sendToAI(userMsg) {
        if (isProcessing) return;

        addMessage('user', userMsg);
        userInput.value = '';
        userInput.focus();

        isProcessing = true;
        const loadingMsg = { role: 'assistant', content: '⏳ Mengetik...' };
        if (!chats[currentChatId]) chats[currentChatId] = [];
        chats[currentChatId].push(loadingMsg);
        renderMessages(currentChatId);

        try {
            const history = (chats[currentChatId] || [])
                .filter(m => m.content !== '⏳ Mengetik...')
                .map(m => ({ role: m.role, content: m.content }));

            console.log('📡 Sending to backend:', BACKEND_URL + '/api/chat');

            const response = await fetch(BACKEND_URL + '/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'llama-3.3-70b-versatile',
                    messages: [
                        { role: 'system', content: SYSTEM_PROMPT },
                        ...history
                    ],
                    max_tokens: 2048,
                    temperature: 0.7
                })
            });

            console.log('📡 Response status:', response.status);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ Server error:', errorText);
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            const data = await response.json();
            console.log('✅ Response received');

            const reply = data.choices?.[0]?.message?.content || 'Maaf, saya tidak bisa menjawab.';

            chats[currentChatId] = chats[currentChatId].filter(m => m.content !== '⏳ Mengetik...');
            chats[currentChatId].push({ role: 'assistant', content: reply });
            saveChat(currentChatId, chats[currentChatId]);
            renderMessages(currentChatId);

        } catch (error) {
            console.error('❌ Error:', error.message);
            chats[currentChatId] = chats[currentChatId].filter(m => m.content !== '⏳ Mengetik...');
            chats[currentChatId].push({ 
                role: 'assistant', 
                content: `❌ Error: ${error.message}\n\nPastikan backend berjalan di:\n${BACKEND_URL}` 
            });
            saveChat(currentChatId, chats[currentChatId]);
            renderMessages(currentChatId);
        } finally {
            isProcessing = false;
        }
    }

    // ============================================================
    // TEXT-TO-SPEECH
    // ============================================================
    function speakText(text) {
        if (!window.speechSynthesis) {
            alert('Browser tidak mendukung TTS.');
            return;
        }

        window.speechSynthesis.cancel();

        const clean = text
            .replace(/\*\*(.*?)\*\*/g, '$1')
            .replace(/\*(.*?)\*/g, '$1')
            .replace(/`([^`]+)`/g, '$1')
            .replace(/```(\w+)?\s*([\s\S]*?)```/g, '$2')
            .replace(/<[^>]*>/g, '')
            .replace(/\n/g, ' ')
            .slice(0, 500);

        if (!clean.trim()) return;

        const utterance = new SpeechSynthesisUtterance(clean);
        utterance.lang = 'id-ID';
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        window.speechSynthesis.speak(utterance);
    }

    // ============================================================
    // VOICE-TO-TEXT (WHISPER)
    // ============================================================
    async function transcribeAudio(blob) {
        try {
            const formData = new FormData();
            formData.append('file', blob, 'voice.webm');
            formData.append('model', 'whisper-large-v3');
            formData.append('language', 'id');
            formData.append('response_format', 'text');

            const response = await fetch(BACKEND_URL + '/api/transcribe', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ Transcribe error:', errorText);
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            return data.text || data || null;

        } catch (error) {
            console.error('❌ Whisper Error:', error.message);
            return null;
        }
    }

    // ============================================================
    // VOICE RECORDING
    // ============================================================
    async function startRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: { 
                    echoCancellation: true, 
                    noiseSuppression: true 
                } 
            });

            let mimeType = 'audio/webm';
            if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
                mimeType = 'audio/webm;codecs=opus';
            }

            mediaRecorder = new MediaRecorder(stream, { mimeType: mimeType });
            audioChunks = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data && e.data.size > 0) {
                    audioChunks.push(e.data);
                }
            };

            mediaRecorder.onstop = async () => {
                voiceBtn.classList.remove('recording');
                if (audioChunks.length === 0) return;

                const audioBlob = new Blob(audioChunks, { type: mimeType });
                const text = await transcribeAudio(audioBlob);

                if (text && text.trim()) {
                    sendToAI(text);
                } else {
                    addMessage('user', '🎤 (Voice note)');
                    addMessage('assistant', 'Maaf, suara tidak terbaca. Silakan coba rekam ulang.');
                }

                stream.getTracks().forEach(t => t.stop());
                isRecording = false;
                mediaRecorder = null;
                audioChunks = [];
            };

            mediaRecorder.start(1000);
            isRecording = true;
            voiceBtn.classList.add('recording');

            // Auto-stop after 60 seconds
            setTimeout(() => {
                if (isRecording) stopRecording();
            }, 60000);

        } catch (err) {
            alert('Izin mikrofon diperlukan untuk merekam suara.');
            console.error('❌ Recording Error:', err);
        }
    }

    function stopRecording() {
        if (mediaRecorder && isRecording) {
            mediaRecorder.stop();
            isRecording = false;
        }
    }

    // ============================================================
    // EVENT LISTENERS
    // ============================================================

    sendBtn.addEventListener('click', () => {
        const msg = userInput.value.trim();
        if (msg && !isProcessing) sendToAI(msg);
    });

    userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            const msg = userInput.value.trim();
            if (msg && !isProcessing) sendToAI(msg);
        }
    });

    voiceBtn.addEventListener('click', () => {
        if (isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    });

    newChatBtn.addEventListener('click', () => {
        currentChatId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        chats[currentChatId] = [];
        saveChat(currentChatId, chats[currentChatId]);
        renderMessages(currentChatId);
        if (window.innerWidth <= 700) sidebar.classList.remove('open');
    });

    clearHistoryBtn.addEventListener('click', () => {
        if (confirm('Hapus semua riwayat chat?')) {
            chats = {};
            localStorage.removeItem('zyrexChats');
            currentChatId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
            chats[currentChatId] = [];
            saveChat(currentChatId, chats[currentChatId]);
            renderMessages(currentChatId);
        }
    });

    toggleBtn.addEventListener('click', () => {
        sidebar.classList.toggle('open');
    });

    themeToggle.addEventListener('click', () => {
        document.body.classList.toggle('dark');
        const icon = themeToggle.querySelector('i');
        icon.classList.toggle('fa-moon');
        icon.classList.toggle('fa-sun');
    });

    // Modal kode - klik pada code block
    document.addEventListener('click', (e) => {
        const target = e.target.closest('pre code');
        if (target) {
            modalCode.textContent = target.textContent;
            modal.classList.remove('hidden');
        }
    });

    closeModal.addEventListener('click', () => modal.classList.add('hidden'));
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.add('hidden');
    });

    copyCodeBtn.addEventListener('click', async () => {
        const text = modalCode.textContent;
        try {
            await navigator.clipboard.writeText(text);
            alert('✅ Kode berhasil disalin!');
        } catch {
            const range = document.createRange();
            range.selectNode(modalCode);
            window.getSelection().removeAllRanges();
            window.getSelection().addRange(range);
            document.execCommand('copy');
            alert('✅ Kode berhasil disalin!');
        }
    });

    // ============================================================
    // INIT / STARTUP
    // ============================================================

    // Cek koneksi backend
    checkBackend();

    // Inisialisasi chat
    if (!chats[currentChatId]) {
        chats[currentChatId] = [];
        chats[currentChatId].push({
            role: 'assistant',
            content: `👋 Halo! Saya **Zyrex AI**, asisten cerdas buatan **Ziferr**.

📌 Saya bisa membantu:
• Coding (semua bahasa)
• Pertanyaan umum
• Penjelasan konsep
• Dan lainnya!

💡 Coba tanyakan apa saja, saya siap membantu!`
        });
        saveChat(currentChatId, chats[currentChatId]);
    }

    renderMessages(currentChatId);
    renderHistory();

    console.log('='.repeat(60));
    console.log('🚀 ZYREX AI - FRONTEND READY');
    console.log('='.repeat(60));
    console.log('🔗 Backend URL:', BACKEND_URL);
    console.log('💬 Chat ID:', currentChatId);
    console.log('📦 Total chats:', Object.keys(chats).length);
    console.log('='.repeat(60));
    console.log('💡 Tips:');
    console.log('  - Ketik pesan lalu Enter');
    console.log('  - Klik 🎤 untuk rekam suara');
    console.log('  - Klik kode untuk menyalin');
    console.log('  - Gunakan 🌙 untuk dark mode');
    console.log('='.repeat(60));
});
