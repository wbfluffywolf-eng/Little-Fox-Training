from base64 import b64encode
from pathlib import Path

import streamlit as st
import streamlit.components.v1 as components


ROOT = Path(__file__).parent
ASSET_TYPES = {
    "assets/app-cover-stroller.png": "image/png",
    "assets/changing-table-fox.png": "image/png",
    "assets/baby-fox-mascot.png": "image/png",
}


def data_uri(path: Path, mime_type: str) -> str:
    return f"data:{mime_type};base64,{b64encode(path.read_bytes()).decode('ascii')}"


def app_html() -> str:
    html = (ROOT / "index.html").read_text(encoding="utf-8")

    for asset, mime_type in ASSET_TYPES.items():
        html = html.replace(asset, data_uri(ROOT / asset, mime_type))

    # Streamlit serves this inside an iframe, so the PWA service worker and
    # manifest are only used when index.html is hosted as a standalone site.
    html = html.replace('<link rel="manifest" href="manifest.json" />', "")
    html = html.replace(
        """
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker.register("sw.js").catch(() => {});
      });
    }
""",
        "",
    )
    return html


st.set_page_config(
    page_title="Little Fox Training",
    layout="wide",
    initial_sidebar_state="collapsed",
)

st.markdown(
    """
    <style>
      .block-container { padding: 0; max-width: none; }
      header, footer, [data-testid="stToolbar"] { display: none; }
      iframe { display: block; }
    </style>
    """,
    unsafe_allow_html=True,
)

components.html(app_html(), height=1800, scrolling=True)
