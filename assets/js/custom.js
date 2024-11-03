window.addEventListener('load', function () {
    postImgList = document.getElementsByTagName("img");
    for (var postImg of postImgList) {
        postImg.parentElement.classList.add("post-img");
    }
})

function scrollToTop() {   
    document.getElementById("top").scrollIntoView();
}

if (window.screen.width <= 800){
    var sidebar = document.getElementById("sidebar");
    var closetoc = document.getElementById("close-toc");
    var toTopMobile = document.getElementById("toTop-mobile");
    var opentoc = document.getElementById("open-toc");
    const closegroup = [sidebar, closetoc, toTopMobile]

    closegroup.forEach(element => {
        element.style.opacity = 0;
        element.style.visibility = "hidden";
    });

    opentoc.onclick = async function(){
        closegroup.forEach(element => {
            element.animate({opacity:[0,1],visibility:["hidden","visible"]},{duration:400,fill:'forwards'});
        });
        opentoc.animate({opacity:[1,0],visibility:["visible","hidden"]},{duration:400,fill:'forwards'});
    }

    closetoc.onclick = async function(){
        closegroup.forEach(element => {
            element.animate({opacity:[1,0],visibility:["visible","hidden"]},{duration:400,fill:'forwards'});
        });
        opentoc.animate({opacity:[0,1],visibility:["hidden","visible"]},{duration:400,fill:'forwards'});
    }
}

