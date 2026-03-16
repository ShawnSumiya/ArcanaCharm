// DOM要素の取得
const hamburger = document.querySelector('.hamburger');
const navMenu = document.querySelector('.nav-menu');
const navLinks = document.querySelectorAll('.nav-link');
const logo = document.querySelector('.logo');
const galleryItems = document.querySelectorAll('.gallery-item');
const memberGalleryItems = document.querySelectorAll('.member-gallery-item');
const modal = document.getElementById('imageModal');
const modalImg = document.getElementById('modalImage');
const modalCaption = document.getElementById('modalCaption');
const closeModal = document.querySelector('.close');

// メンバー選択メニューの要素
const mainGroupPhoto = document.getElementById('mainGroupPhoto');
const memberSelectionMenu = document.getElementById('memberSelectionMenu');
const closeSelectionBtn = document.getElementById('closeSelectionBtn');
const memberSelectionItems = document.querySelectorAll('.member-selection-item');

// ロゴクリック時のホーム遷移
// ロゴクリック時のホーム遷移
logo.addEventListener('click', () => {
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });

    // モバイルメニューを閉じる
    navMenu.classList.remove('active');
    hamburger.classList.remove('active');
});

// ハンバーガーメニューの切り替え
hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('active');
    navMenu.classList.toggle('active');
});

// ナビゲーションリンククリック時の処理
navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = link.getAttribute('href');
        const targetSection = document.querySelector(targetId);
        
        if (targetSection) {
            targetSection.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
        
        // モバイルメニューを閉じる
        navMenu.classList.remove('active');
        hamburger.classList.remove('active');
    });
});

// グループ画像クリック時にメンバー選択ページに遷移
if (mainGroupPhoto) {
    mainGroupPhoto.addEventListener('click', () => {
        window.location.href = 'member-selection.html';
    });
}

// メンバー選択時の個人ページ遷移
memberSelectionItems.forEach(item => {
    item.addEventListener('click', () => {
        const memberId = item.getAttribute('data-member');
        
        // メンバーIDに基づいてページ遷移
        const memberPages = {
            'yuuana': 'yuuana-gallery.html',
            'kanakana': 'kanakana-gallery.html',
            'yaya': 'yaya-gallery.html',
            'unoki': 'unoki-gallery.html'
        };
        
        const targetPage = memberPages[memberId];
        if (targetPage) {
            window.location.href = targetPage;
        }
    });
});

// メンバー選択メニューを閉じる
if (closeSelectionBtn) {
    closeSelectionBtn.addEventListener('click', () => {
        memberSelectionMenu.style.display = 'none';
    });
}

// メンバー選択メニュー外クリックで閉じる
if (memberSelectionMenu) {
    memberSelectionMenu.addEventListener('click', (e) => {
        if (e.target === memberSelectionMenu) {
            memberSelectionMenu.style.display = 'none';
        }
    });
}

// 画像クリック時のモーダル表示（グループ画像は除外）
galleryItems.forEach(item => {
    // グループ画像は除外（メンバー選択メニューが表示されるため）
    if (item.id === 'mainGroupPhoto') return;
    
    const img = item.querySelector('img');
    const overlay = item.querySelector('.gallery-overlay');
    
    [img, overlay].forEach(element => {
        element.addEventListener('click', () => {
            modal.style.display = 'block';
            modalImg.src = img.src;
            modalCaption.innerHTML = `
                <h3>${overlay.querySelector('h3').textContent}</h3>
                <p>${overlay.querySelector('p').textContent}</p>
            `;
            document.body.style.overflow = 'hidden';
        });
    });
});

// モーダルを閉じる
closeModal.addEventListener('click', () => {
    modal.style.display = 'none';
    document.body.style.overflow = 'auto';
});

// モーダル外クリックで閉じる
modal.addEventListener('click', (e) => {
    if (e.target === modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
});

// ESCキーでモーダルを閉じる
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.style.display === 'block') {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
});

// スムーススクロール
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// ヘッダーのスクロール効果
window.addEventListener('scroll', () => {
    const header = document.querySelector('.header');
    if (window.scrollY > 100) {
        header.style.background = 'rgba(255, 255, 255, 0.98)';
        header.style.boxShadow = '0 2px 20px rgba(0,0,0,0.1)';
    } else {
        header.style.background = 'rgba(255, 255, 255, 0.95)';
        header.style.boxShadow = 'none';
    }
});

/// フォーム送信処理
const contactForm = document.querySelector('.contact-form');
if (contactForm) {
	contactForm.addEventListener('submit', async (e) => {
		e.preventDefault();

		const formData = new FormData(contactForm);
		const name = formData.get('name');
		const email = formData.get('email');
		const message = formData.get('message');

		if (!name || !email || !message) {
			alert('すべてのフィールドを入力してください。');
			return;
		}

		// 送信ボタンを無効化して重複送信を防ぐ
		const submitBtn = contactForm.querySelector('.submit-btn');
		const originalText = submitBtn.textContent;
		submitBtn.disabled = true;
		submitBtn.textContent = '送信中...';

		try {
			// Formspreeへの送信
			const response = await fetch('https://formspree.io/f/xblzygzb', {
				method: 'POST',
				headers: {
					'Accept': 'application/json'
				},
				body: formData
			});

			if (response.ok) {
				alert('お問い合わせありがとうございます！後ほど担当者よりご連絡いたします。');
				contactForm.reset();
			} else {
				throw new Error('送信に失敗しました');
			}
		} catch (error) {
			alert('送信に失敗しました。しばらく時間をおいて再度お試しください。');
			console.error('Form submission error:', error);
		} finally {
			// ボタンを元に戻す
			submitBtn.disabled = false;
			submitBtn.textContent = originalText;
		}
	});
}

// アニメーション用のCSSを動的に追加
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeIn {
        from {
            opacity: 0;
            transform: translateY(20px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
    
    .gallery-item {
        animation: fadeIn 0.5s ease-in;
    }
    
    .member-gallery-item {
        animation: fadeIn 0.6s ease-in;
    }
    
    .member-card {
        animation: fadeIn 0.6s ease-in;
    }
    
    .about-content {
        animation: fadeIn 0.7s ease-in;
    }
    
    .contact-content {
        animation: fadeIn 0.8s ease-in;
    }
`;
document.head.appendChild(style);

// スクロール時のアニメーション
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

// アニメーション対象要素の設定
document.querySelectorAll('.gallery-item, .member-gallery-item, .member-card, .about-content, .contact-content').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(30px)';
    el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    observer.observe(el);
});

// ページ読み込み完了時の処理
window.addEventListener('load', () => {
    // 確実にTOPにスクロール
    window.scrollTo(0, 0);
    
    // ローディングアニメーション（必要に応じて）
    document.body.style.opacity = '1';
    
    // ヒーローセクションのアニメーション
    const heroContent = document.querySelector('.hero-content');
    if (heroContent) {
        heroContent.style.opacity = '0';
        heroContent.style.transform = 'translateY(50px)';
        heroContent.style.transition = 'opacity 1s ease, transform 1s ease';
        
        setTimeout(() => {
            heroContent.style.opacity = '1';
            heroContent.style.transform = 'translateY(0)';
        }, 300);
    }
});

// 追加：ページ表示時に確実にTOPにスクロール
document.addEventListener('DOMContentLoaded', () => {
    window.scrollTo(0, 0);
});

// ギャラリーアイテムのホバー効果を強化
galleryItems.forEach(item => {
    item.addEventListener('mouseenter', () => {
        item.style.transform = 'translateY(-10px) scale(1.02)';
    });
    
    item.addEventListener('mouseleave', () => {
        item.style.transform = 'translateY(0) scale(1)';
    });
});

// メンバーギャラリーアイテムのホバー効果を強化
memberGalleryItems.forEach(item => {
    item.addEventListener('mouseenter', () => {
        item.style.transform = 'translateY(-10px) scale(1.02)';
    });
    
    item.addEventListener('mouseleave', () => {
        item.style.transform = 'translateY(0) scale(1)';
    });
});

// メンバーカードのホバー効果を強化
document.querySelectorAll('.member-card').forEach(card => {
    card.addEventListener('mouseenter', () => {
        card.style.transform = 'translateY(-15px) scale(1.02)';
        card.style.boxShadow = '0 20px 40px rgba(0,0,0,0.15)';
    });
    
    card.addEventListener('mouseleave', () => {
        card.style.transform = 'translateY(0) scale(1)';
        card.style.boxShadow = '0 15px 35px rgba(0,0,0,0.1)';
    });
});

console.log('Arcana Charm フォトギャラリーサイトが読み込まれました！');
