# thanc
thanc: a smart way to thank the authors of NPM packages by starring their repos on Github

## Why thanc and not just thank?!?
Basically, because the thank (and also thanks) package already exists on NPM registry.

Thanc (or thancian) is the ancient english word to say thank, so that's why :bowtie:

## Installation
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

## Usage
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

Thanking with non-interactive way:

```bash
$ thanc -u <your_github_username> -p <your_github_password> .
```

## Limitations
Github APIs have some limitations:

1. [rate limiting](https://developer.github.com/v3/#rate-limiting): each user can perform **5000 requests per hour**, so if you're using thanc intensively, you may encounter the rate limit error. Don't panic, take a coffee with a friend, and then start back starring repos :muscle:
2. [abuse rate limit](https://developer.github.com/v3/#abuse-rate-limits): Github prevents making lots of rapidly requests for a single user (they want to guarantee the quality of service) so thanc stars chunks of **35 repos at a time.**

## Known Issues
Some repos cannot be starred, due to:

- missing repository property on package.json manifest
- missing package on NPM registry (thanc relies on that)
- missing repository on Github (thanc uses NPM registry info)