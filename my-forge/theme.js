export function theme(){
  const themeBtn = document.getElementById('theme-btn');
  themeBtn.addEventListener('click', () => {
    document.body.classList.contains('light')
      ? document.body.classList.replace('light', 'dark')
      : document.body.classList.replace('dark', 'light');
  });
}

