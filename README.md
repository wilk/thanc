# thanc
Thanc: a smart way to thank NPM packages authors by starring their repos

## Install locally
```bash
$ npm i -D thanc
```

Then, under the scripts section of the package.json:
```bash
"thanc": "thanc"
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

Thank thanc project:

```bash
$ thanc --me
```