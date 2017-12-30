# ⭐  thanc
thanc: a smart way to thank the authors of NPM packages by starring their repos on Github :heart:

Why thanc you'll thank every dependencies and sub-dependencies (**literally the whole dependencies tree**) of a given project provided with a `package.json` (or better a `package-lock.json`) manifest.
So yes, it works also with `yarn` 😺

This is what thanc looks like:

![start](https://github.com/wilk/thanc/raw/master/start.png "start")

and too many repos after:

![end](https://github.com/wilk/thanc/raw/master/end.png "end")

Inspired by:

- https://github.com/zwilias/elm-thanks
- https://github.com/symfony/thanks

## 🤔  Why thanc and not just thank?!?
Basically, because the thank (and also thanks) package already exists on NPM registry.

Thanc (or thancian) is the ancient english word to say thank, so that's why :bowtie:

## 🔒  Authentication Types Supported
thanc supports two types of authentication:

- **Basic**: it requires your Github username and password
- **Token**: it requires one of your Github user token (just **[create a new token](https://github.com/settings/tokens/new)** here with `public_repo` permission)

## 🛠  Installation
thanc can be installed locally or globally.
 
### Install locally
```bash
$ npm i -D thanc
```

Then, under the scripts section of your `package.json`:
```bash
"thanc": "thanc ."
```

And then:
```bash
$ npm run thanc
```

### Install globally
```bash
$ npm i -g thanc
```

Then:
```bash
$ thanc
```

## ⚙  Usage
Thanking current folder:

```bash
$ thanc
```

Thanking a specific folder:

```bash
$ thanc myProject
```

Thanking the `thanc` project:

```bash
$ thanc --me
```

Thanking without seeing the repos list but a progress bar instead:

```bash
$ thanc --quite .
```

### Explicit credentials

**Basic Auth**
```bash
$ thanc -u <your_github_username> -p <your_github_password> .
```

**User Token**

Explicit:
```bash
$ thanc -t <your_github_token> .
```

Via `GITHUB_TOKEN` env var:
```bash
$ export GITHUB_TOKEN=<your_github_token>; thanc .
```

## ✋  Limitations
Github APIs have some limitations:

1. [rate limiting](https://developer.github.com/v3/#rate-limiting): each user can perform **5000 requests per hour**, so if you're using thanc intensively, you may encounter the rate limit error. Don't panic, take a coffee with a friend, and then start back starring repos :muscle:
2. [abuse rate limit](https://developer.github.com/v3/#abuse-rate-limits): Github prevents making lots of rapidly requests for a single user (they want to guarantee the quality of service) so thanc stars chunks of **35 repos at a time.**

## 💥  Known Issues
Some repos cannot be starred, due to:

- missing repository property on package.json manifest
- missing package on NPM registry (thanc relies on that)
- missing repository on Github (thanc uses NPM registry info)

Sometimes, some repos can be starred twice because they might have a very similar url but different, pointing to the same github repo