// ギャラリーページ共通のJavaScript
// import { createClient } from 'microcms-js-sdk'; // ブラウザでは使用しないためコメントアウト

// 管理画面のデータを読み込み
let siteData = {
    gallery: {
        photos: []
    }
};

// メンバー別のデフォルト写真データ
const defaultPhotos = {
    '有ゆうな': [
        { path: '/Users/d.dpokersumiya/Documents/Arcana Charm_sample/Photo/yuuna/1.PreDress.yuuna.webp', title: 'プレ衣装' },
        { path: '/Users/d.dpokersumiya/Documents/Arcana Charm_sample/Photo/yuuna/2.Feburualy.yuuna.webp', title: 'February/2025' },
        { path: '/Users/d.dpokersumiya/Documents/Arcana Charm_sample/Photo/yuuna/3.debutDress.yuuna.webp', title: 'デビュー衣装' },
        { path: '/Users/d.dpokersumiya/Documents/Arcana Charm_sample/Photo/yuuna/4.March.yuuna.webp', title: 'March/2025' },
        { path: '/Users/d.dpokersumiya/Documents/Arcana Charm_sample/Photo/yuuna/5.April.yuuna.webp', title: 'April/2025' },
        { path: '/Users/d.dpokersumiya/Documents/Arcana Charm_sample/Photo/yuuna/6.PolkadottDress.yuuna.webp', title: '水玉衣装' },
        { path: '/Users/d.dpokersumiya/Documents/Arcana Charm_sample/Photo/yuuna/7.May.yuuna.webp', title: 'May/2025' },
        { path: '/Users/d.dpokersumiya/Documents/Arcana Charm_sample/Photo/yuuna/8.June.yuuna.webp', title: 'June/2025' },
        { path: '/Users/d.dpokersumiya/Documents/Arcana Charm_sample/Photo/yuuna/9_dress_yuuna.webp', title: 'ドレス衣装' },
        { path: '/Users/d.dpokersumiya/Documents/Arcana Charm_sample/Photo/yuuna/10.July.yuuna.webp', title: 'July/2025' },
        { path: '/Users/d.dpokersumiya/Documents/Arcana Charm_sample/Photo/yuuna/11.August.yuuna.webp', title: 'August/2025' },
        { path: '/Users/d.dpokersumiya/Documents/Arcana Charm_sample/Photo/yuuna/12.September.yuuna.webp', title: 'September/2025' }
    ],
    '宇野木ゆか': [
        { path: 'Photo/unoki/1_PreDress_yuka.webp', title: 'プレ衣装' },
        { path: 'Photo/unoki/2_Feburualy_yuka.webp', title: 'February/2025' },
        { path: 'Photo/unoki/3_debutdress_yuka.webp', title: 'デビュー衣装' },
        { path: 'Photo/unoki/4_March_yuka.webp', title: 'March/2025' },
        { path: 'Photo/unoki/5_April_yuka.webp', title: 'April/2025' },
        { path: 'Photo/unoki/6_polkadottdress_yuka.webp', title: '水玉衣装' },
        { path: 'Photo/unoki/7_May_yuka.webp', title: 'May/2025' },
        { path: 'Photo/unoki/8_June_yuka.webp', title: 'June/2025' },
        { path: 'Photo/unoki/9_dress_yuka.webp', title: 'ドレス衣装' },
        { path: 'Photo/unoki/10_July_yuka.webp', title: 'July/2025' },
        { path: 'Photo/unoki/11_August_yuka.webp', title: 'August/2025' },
        { path: 'Photo/unoki/12_September_yuka.webp', title: 'September/2025' }
    ],
    'やや': [
        { path: 'Photo/yaya/yaya_dress.jpeg', title: 'やや' }
    ],
    '華本かな': [
        { path: 'Photo/hanamoto/hanamoto_dress.jpeg', title: '華本かな' }
    ]
};

// async function getGalleryImgData(){
//     const client = createClient({
//         serviceDomain: 'arcanacharm',
//         apiKey: process.env.MICROCMS_API_KEY,
//     });

//     const data = await client.get({
//         endpoint: 'gallery-img',
//     });

//     return data.contents;
// }

// データの読み込み
function loadData() {
    const savedData = localStorage.getItem('arcanacharm_data');
    if (savedData) {
        siteData = { ...siteData, ...JSON.parse(savedData) };
    }
}

// メンバーの写真を生成
function generateMemberPhotos(memberName) {
    const container = document.getElementById('member-photos');
    if (!container) return;
    
    const memberPhotos = siteData.gallery.photos.filter(photo => photo.category === memberName);
    
    if (memberPhotos.length === 0) {
        // デフォルトの写真を表示
        const defaultMemberPhotos = defaultPhotos[memberName] || [];
        container.innerHTML = defaultMemberPhotos.map(photo => `
            <div class="member-photo-item">
                <img src="${photo.path}" alt="${photo.title}">
                <div class="member-photo-overlay">
                    <h3>${photo.title}</h3>
                    <i class="fas fa-search-plus"></i>
                </div>
            </div>
        `).join('');
    } else {
        container.innerHTML = memberPhotos.map(photo => `
            <div class="member-photo-item">
                <img src="${photo.path}" alt="${photo.title}">
                <div class="member-photo-overlay">
                    <h3>${photo.title}</h3>
                    <i class="fas fa-search-plus"></i>
                </div>
            </div>
        `).join('');
    }
    
    // イベントリスナーを再設定
    setupModalEvents();
}

// モーダルイベントの設定
function setupModalEvents() {
    document.querySelectorAll('.member-photo-item').forEach(item => {
        const img = item.querySelector('img');
        const overlay = item.querySelector('.member-photo-overlay');
        
        [img, overlay].forEach(element => {
            element.addEventListener('click', () => {
                const modal = document.getElementById('imageModal');
                const modalImg = document.getElementById('modalImage');
                const modalCaption = document.getElementById('modalCaption');
                
                modal.style.display = 'block';
                modalImg.src = img.src;
                modalCaption.innerHTML = `
                    <h3>${overlay.querySelector('h3').textContent}</h3>
                `;
                document.body.style.overflow = 'hidden';
            });
        });
    });
}

// モーダルを閉じる
function closeModal() {
    document.getElementById('imageModal').style.display = 'none';
    document.body.style.overflow = 'auto';
}

// ページ読み込み時の初期化
function initializeGallery(memberName) {
    loadData();
    generateMemberPhotos(memberName);
    
    // モーダルイベントの設定
    document.querySelector('.close').addEventListener('click', closeModal);
    
    document.getElementById('imageModal').addEventListener('click', (e) => {
        if (e.target === document.getElementById('imageModal')) {
            closeModal();
        }
    });
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && document.getElementById('imageModal').style.display === 'block') {
            closeModal();
        }
    });
}
// グローバルスコープで関数を利用可能にする
window.initializeGallery = initializeGallery;
window.generateMemberPhotos = generateMemberPhotos;
window.setupModalEvents = setupModalEvents;
window.closeModal = closeModal;