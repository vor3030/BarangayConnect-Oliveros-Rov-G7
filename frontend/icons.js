import lottie from "lottie-web/build/player/lottie_light";

export function mountIcons(reducedMotion) {
  for (const icon of document.querySelectorAll("[data-icon-animation]")) {
    const target = icon.closest("a, button");
    const player = lottie.loadAnimation({
      container: icon,
      renderer: "svg",
      autoplay: false,
      loop: false,
      path: icon.dataset.iconAnimation,
    });

    player.addEventListener("DOMLoaded", () => {
      player.goToAndStop(0, true);
      icon.dataset.iconReady = "true";
    });

    const play = () => {
      if (!reducedMotion.matches) player.goToAndPlay(0, true);
    };
    target?.addEventListener("pointerenter", play);
    target?.addEventListener("focus", play);
    reducedMotion.addEventListener("change", () => {
      if (reducedMotion.matches) player.goToAndStop(0, true);
    });
  }
}
