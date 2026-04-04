document.addEventListener('DOMContentLoaded', async () => {
  const loadingState = document.getElementById('state-loading');
  const errorState = document.getElementById('state-error');
  const dashboardState = document.getElementById('state-dashboard');
  const errorMessage = document.getElementById('error-message');
  const userGreeting = document.getElementById('user-greeting');

  try {
    // 1. Verify Authentication
    const token = api.getToken();
    if (!token) {
      throw new Error('You must be logged in to access the portal.');
    }

    // 2. Fetch User Profile
    const user = await api.auth.getMe();
    if (user.firstName) {
      userGreeting.textContent = `Welcome back, ${user.firstName}`;
    }

    // 3. Fetch Course Content (will throw error if not purchased/authorized)
    const { modules, overallProgress } = await api.course.getModules();

    // 4. Render Content
    renderProgress(overallProgress);
    renderModules(modules);

    // 5. Show Dashboard
    loadingState.classList.add('hidden');
    dashboardState.classList.remove('hidden');

  } catch (err) {
    loadingState.classList.add('hidden');
    errorState.classList.remove('hidden');
    errorMessage.textContent = err.message || 'Access denied. Please ensure you have purchased the program.';
  }
});

function logout() {
  api.clearSession();
  window.location.href = '/';
}

function renderProgress(progress) {
  document.getElementById('progress-text').textContent = `${progress.completed} of ${progress.total} lessons completed`;
  document.getElementById('progress-bar').style.width = `${progress.percentage}%`;
}

function renderModules(modules) {
  const container = document.getElementById('modules-container');
  container.innerHTML = '';

  modules.forEach(module => {
    const moduleEl = document.createElement('div');
    moduleEl.className = 'border border-white/[0.04] bg-[#0d0d0d] rounded-sm overflow-hidden';
    
    // Header
    const headerHTML = `
      <div class="px-6 py-6 sm:px-8 sm:py-8 border-b border-white/[0.04]">
        <div class="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 mb-2">
          <h3 class="font-display text-2xl sm:text-3xl text-bone">${module.title}</h3>
          <span class="font-mono text-xs tracking-widest text-accent uppercase">${module.subtitle}</span>
        </div>
        <p class="text-silver text-sm leading-relaxed max-w-3xl">${module.description}</p>
        
        <div class="mt-6 flex items-center gap-3">
          <div class="w-full max-w-xs bg-charcoal h-1.5 rounded-full overflow-hidden">
            <div class="h-full bg-accent" style="width: ${module.progress.percentage}%"></div>
          </div>
          <span class="text-xs font-mono text-silver/60">${module.progress.percentage}%</span>
        </div>
      </div>
    `;

    // Lessons List
    let lessonsHTML = `<div class="divide-y divide-white/[0.02]">`;
    module.lessons.forEach(lesson => {
      const icon = lesson.completed 
        ? `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" class="text-accent"><circle cx="10" cy="10" r="9" stroke="currentColor" stroke-width="1.5"/><path d="M6 10l3 3 5-6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`
        : `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" class="text-silver/30"><circle cx="10" cy="10" r="9" stroke="currentColor" stroke-width="1.5"/></svg>`;

      lessonsHTML += `
        <div class="px-6 py-4 sm:px-8 flex items-center justify-between hover:bg-white/[0.02] transition-colors cursor-pointer group">
          <div class="flex items-center gap-4">
            ${icon}
            <div>
              <p class="text-sm sm:text-base text-bone group-hover:text-accent transition-colors">${lesson.title}</p>
              <p class="text-xs text-silver/50 font-mono mt-1">${lesson.type === 'video' ? '📺 Video' : '📝 Exercise'} · ${lesson.duration}</p>
            </div>
          </div>
          <button onclick="toggleLesson('${module.id}', '${lesson.id}')" class="opacity-0 group-hover:opacity-100 transition-opacity text-xs font-mono text-silver hover:text-white border border-white/10 px-3 py-1.5 rounded-sm">
            ${lesson.completed ? 'Review' : 'Start'}
          </button>
        </div>
      `;
    });
    lessonsHTML += `</div>`;

    moduleEl.innerHTML = headerHTML + lessonsHTML;
    container.appendChild(moduleEl);
  });
}

// Function to handle clicking 'Start'
async function toggleLesson(moduleId, lessonId) {
  try {
    // In a real app, this would route to a video player
    // For this prototype, we'll just mark it complete
    await api.course.markLessonComplete(moduleId, lessonId);
    
    // Refresh UI
    const { modules, overallProgress } = await api.course.getModules();
    renderProgress(overallProgress);
    renderModules(modules);
  } catch (err) {
    alert(err.message || 'Error updating lesson');
  }
}
