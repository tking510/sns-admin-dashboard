// SNS Admin Dashboard - Frontend JavaScript

const API_BASE_URL = 'https://sns-admin-api.slotenpromotion.com';

// DOM Elements
const postForm = document.getElementById('postForm');
const contentInput = document.getElementById('content');
const charCount = document.getElementById('charCount');
const imageUpload = document.getElementById('imageUpload');
const imageInput = document.getElementById('images');
const imagePreview = document.getElementById('imagePreview');
const previewBtn = document.getElementById('previewBtn');
const previewModal = document.getElementById('previewModal');
const previewContent = document.getElementById('previewContent');
const closeModal = document.querySelector('.close');
const postsTableBody = document.getElementById('postsTableBody');
const statusFilter = document.getElementById('statusFilter');
const refreshBtn = document.getElementById('refreshBtn');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadPosts();
    setupEventListeners();
    setDefaultScheduleTime();
});

// Event Listeners
function setupEventListeners() {
    // Character count
    contentInput.addEventListener('input', updateCharCount);
    
    // Form submission
    postForm.addEventListener('submit', handleSubmit);
    
    // Image upload
    imageUpload.addEventListener('click', () => imageInput.click());
    imageUpload.addEventListener('dragover', handleDragOver);
    imageUpload.addEventListener('drop', handleDrop);
    imageInput.addEventListener('change', handleImageSelect);
    
    // Preview
    previewBtn.addEventListener('click', showPreview);
    closeModal.addEventListener('click', hidePreview);
    window.addEventListener('click', (e) => {
        if (e.target === previewModal) hidePreview();
    });
    
    // Filter & Refresh
    statusFilter.addEventListener('change', loadPosts);
    refreshBtn.addEventListener('click', loadPosts);
}

// Character Count
function updateCharCount() {
    const count = contentInput.value.length;
    charCount.textContent = count;
    
    if (count > 280) {
        charCount.style.color = 'var(--danger-color)';
    } else if (count > 250) {
        charCount.style.color = 'var(--warning-color)';
    } else {
        charCount.style.color = 'var(--secondary-color)';
    }
}

// Set default schedule time (tomorrow 12:00)
function setDefaultScheduleTime() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(12, 0, 0, 0);
    
    const formatted = tomorrow.toISOString().slice(0, 16);
    document.getElementById('scheduled_at').value = formatted;
}

// Image Upload Handlers
function handleDragOver(e) {
    e.preventDefault();
    imageUpload.style.borderColor = 'var(--primary-color)';
}

function handleDrop(e) {
    e.preventDefault();
    imageUpload.style.borderColor = 'var(--border-color)';
    const files = e.dataTransfer.files;
    handleFiles(files);
}

function handleImageSelect(e) {
    const files = e.target.files;
    handleFiles(files);
}

function handleFiles(files) {
    imagePreview.innerHTML = '';
    
    Array.from(files).forEach(file => {
        if (!file.type.startsWith('image/')) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = document.createElement('img');
            img.src = e.target.result;
            imagePreview.appendChild(img);
        };
        reader.readAsDataURL(file);
    });
}

// Form Submission
async function handleSubmit(e) {
    e.preventDefault();
    
    const content = contentInput.value;
    const scheduledAt = document.getElementById('scheduled_at').value;
    const platformCheckboxes = document.querySelectorAll('input[name="platform"]:checked');
    
    if (platformCheckboxes.length === 0) {
        alert('投稿先を選択してください');
        return;
    }
    
    const platforms = {};
    platformCheckboxes.forEach(cb => {
        platforms[cb.value] = true;
    });
    
    const postData = {
        content,
        scheduled_at: scheduledAt,
        platforms,
        images: []
    };
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/posts`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(postData)
        });
        
        if (response.ok) {
            alert('投稿を保存しました！');
            postForm.reset();
            imagePreview.innerHTML = '';
            setDefaultScheduleTime();
            loadPosts();
        } else {
            const error = await response.json();
            alert('エラー: ' + error.error);
        }
    } catch (error) {
        alert('通信エラー: ' + error.message);
    }
}

// Load Posts
async function loadPosts() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/posts`);
        const posts = await response.json();
        
        const filter = statusFilter.value;
        const filteredPosts = filter === 'all' 
            ? posts 
            : posts.filter(p => p.status === filter);
        
        renderPosts(filteredPosts);
    } catch (error) {
        console.error('Failed to load posts:', error);
        postsTableBody.innerHTML = '<tr><td colspan="6">データの読み込みに失敗しました</td></tr>';
    }
}

// Render Posts Table
function renderPosts(posts) {
    if (posts.length === 0) {
        postsTableBody.innerHTML = '<tr><td colspan="6">投稿がありません</td></tr>';
        return;
    }
    
    postsTableBody.innerHTML = posts.map(post => {
        const platforms = JSON.parse(post.platforms || '{}');
        const platformIcons = getPlatformIcons(platforms);
        
        return `
            <tr>
                <td>${post.id}</td>
                <td class="content-preview" title="${escapeHtml(post.content)}">${escapeHtml(post.content)}</td>
                <td class="platform-icons">${platformIcons}</td>
                <td>${formatDate(post.scheduled_at)}</td>
                <td><span class="status-badge status-${post.status}">${getStatusText(post.status)}</span></td>
                <td>
                    <button class="btn btn-secondary" onclick="editPost(${post.id})" ${post.status !== 'pending' ? 'disabled' : ''}>
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-danger" onclick="deletePost(${post.id})" ${post.status === 'posted' ? 'disabled' : ''}>
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// Get Platform Icons
function getPlatformIcons(platforms) {
    const platformMap = {
        telegram: 'fa-telegram',
        discord: 'fa-discord',
        x: 'fa-x-twitter',
        instagram: 'fa-instagram',
        facebook: 'fa-facebook',
        threads: 'fa-at',
        youtube: 'fa-youtube',
        email: 'fa-envelope'
    };
    
    return Object.entries(platforms)
        .filter(([_, enabled]) => enabled)
        .map(([platform]) => `<i class="fab ${platformMap[platform]} active" title="${platform}"></i>`)
        .join('');
}

// Status Text
function getStatusText(status) {
    const statusMap = {
        pending: '予約済み',
        posted: '投稿済み',
        failed: '失敗',
        cancelled: 'キャンセル'
    };
    return statusMap[status] || status;
}

// Format Date
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Preview
function showPreview() {
    const content = contentInput.value;
    const platforms = Array.from(document.querySelectorAll('input[name="platform"]:checked'))
        .map(cb => cb.value);
    
    if (!content) {
        alert('投稿内容を入力してください');
        return;
    }
    
    previewContent.innerHTML = `
        <h4>内容:</h4>
        <p style="white-space: pre-wrap; margin-bottom: 20px;">${escapeHtml(content)}</p>
        <h4>投稿先:</h4>
        <p>${platforms.length > 0 ? platforms.join(', ') : '未選択'}</p>
    `;
    
    previewModal.style.display = 'block';
}

function hidePreview() {
    previewModal.style.display = 'none';
}

// Edit Post
async function editPost(id) {
    // TODO: Implement edit functionality
    alert('編集機能は開発中です');
}

// Delete Post
async function deletePost(id) {
    if (!confirm('この投稿を削除しますか？')) return;
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/posts/${id}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            alert('削除しました');
            loadPosts();
        } else {
            alert('削除に失敗しました');
        }
    } catch (error) {
        alert('通信エラー: ' + error.message);
    }
}

// Auto-refresh every 30 seconds
setInterval(loadPosts, 30000);