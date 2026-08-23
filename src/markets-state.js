const KEY = "borjai:mvp:v1";
function sync(){
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) window.BORJAI_APP_STATE = JSON.parse(raw);
  } catch (_) {}
}
sync();
setInterval(sync, 1500);
