var swiper = new Swiper(".mySwiper", {
    slidesPerView: 1,
    spaceBetween: 30,
    loop: true,
    autoplay: {
        delay: 8000,
        disableOnInteraction: false
    },
    pagination: {
      el: ".swiper-pagination",
      clickable: true,
    },
    navigation: {
      nextEl: ".swiper-button-next",
      prevEl: ".swiper-button-prev",
    },
  });

   //@todo: Configurar para mobile depois.
   var swiperDestaqueServicos = new Swiper(".carousel-destaque-servicos", {
    slidesPerView: 8,
    spaceBetween: 0,
    loop: false,
    loopPreventsSliding: false,
    // autoplay: {
    //     delay: 8000,
    //     //disableOnInteraction: false
    // },
    pauseOnMouseEnter: true,
    disableOnInteraction: true,
    //spaceBetween: 0, //margem entre os itens do slide
    breakpoints: {
        0: {
            slidesPerView: 2,
            grid: { rows: 2 },
            slidesPerGroup: 2,
        },
        640: {
            slidesPerView: 2,
            grid: { rows: 2 },
            slidesPerGroup: 2,
        },
        768: {
            slidesPerView: 3,
            slidesPerGroup: 3,
        },
        1024: {
            slidesPerView: 6,
            slidesPerGroup: 4,
        },
        1200: {
            slidesPerView: 8,
            slidesPerGroup: 8,
        },
    },
    navigation: {
        nextEl: ".swiper-button-next",
        prevEl: ".swiper-button-prev",
    },
    pagination: {
        el: ".swiper-pagination",
        clickable: true,
    },
}); 


var swiperNoticias = new Swiper(".carousel-noticias", {
  slidesPerView: 1,
  spaceBetween: 0,
  loop: true,
  loopPreventsSliding: false,
  autoplay: {
      delay: 8000,
      disableOnInteraction: false
  },
  breakpoints: {
      0: {
          slidesPerView: 1,
          //spaceBetween: 0,
      },
      640: {
          slidesPerView: 1,
      },
      768: {
          slidesPerView: 1,
      },
      1024: {
          slidesPerView: 1,
      },
  },
  navigation: {
      nextEl: ".swiper-button-next",
      prevEl: ".swiper-button-prev",
  },
  pagination: {
      el: ".swiper-pagination",
      clickable: true,
  },
});