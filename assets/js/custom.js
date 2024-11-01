function scrollToTop() {   
    document.getElementById("top").scrollIntoView();
}

var sidebar = document.getElementById("sidebar");
var closetoc = document.getElementById("close-toc");
var toTopMobile = document.getElementById("toTop-mobile");
var opentoc = document.getElementById("open-toc");

sidebar.style.opacity = 0;
sidebar.style.visibility = "hidden";
closetoc.style.opacity = 0;
closetoc.style.visibility = "hidden";
toTopMobile.style.opacity = 0;
toTopMobile.style.visibility = "hidden";

opentoc.onclick = function(){
    sidebar.classList.add('fade-in');
    closetoc.classList.add('fade-in');
    toTopMobile.classList.add('fade-in');
    opentoc.classList.add('fade-out');
    sidebar.classList.remove('fade-out');
    closetoc.classList.remove('fade-out');
    toTopMobile.classList.remove('fade-out');
    opentoc.classList.remove('fade-in');
}

closetoc.onclick = function(){
    sidebar.classList.add('fade-out');
    closetoc.classList.add('fade-out');
    toTopMobile.classList.add('fade-out');
    opentoc.classList.add('fade-in');
    sidebar.classList.remove('fade-in');
    closetoc.classList.remove('fade-in');
    toTopMobile.classList.remove('fade-in');
    opentoc.classList.remove('fade-out');
}
