# thanc
Thanc: a smart way to thank NPM packages authors by starring their repos

## Install locally
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

## Install globally
```bash
$ npm i -g thanc
```

Then:
```bash
$ thanc
```

## Usage
Thank current folder:

```bash
$ thanc
```

Thank a specific folder:

```bash
$ thanc myProject
```

Thank the `thanc` project:

```bash
$ thanc --me
```

Thank with non-interactive way:

```bash
$ thanc -u <your_github_username> -p <your_github_password> .
```