const RegistryClient = require('npm-registry-client')
const client = new RegistryClient()
const NPM_REGISTRY_URL = 'https://registry.npmjs.org'
const GITHUB_API_URL = 'https://api.github.com'
const GITHUB_STAR_URL = `${GITHUB_API_URL}/user/starred`
const axios = require('axios')
const prompt = require('prompt')
const fs = require('fs')
const util = require('util')
const asyncReadFile = util.promisify(fs.readFile)
const asyncAccessFile = util.promisify(fs.access)
const EXIT_FAILURE = 1
const program = require('commander')
const path = require('path')
const npm = require('npm')

const schema = {
  properties: {
    username: {
      description: 'Your github username',
      type: 'string',
      required: true
    },
    password: {
      description: 'Your github password',
      type: 'string',
      hidden: true,
      required: true
    },
    packageLockPath: {
      description: 'Your package-lock.json path',
      type: 'string',
      default: DEFAULT_PACKAGE_LOCK_PATH
    }
  }
}

// get user info
const getUserInfo = schema => {
  return new Promise((resolve, reject) => {
    prompt.get(schema, function (err, data) {
      if (err) reject(err)
      else resolve(data)
    })
  })
}

(async () => {
  let projectPath = '.'
  program
    .arguments('<path>')
    .action(path => projectPath = path ? path : projectPath)
    .parse(process.argv)

  let manifest, manifestExists = true

  // looking for package.json file
  try {
    manifest = await asyncReadFile(path.resolve(projectPath, './package-lock.json'), 'utf-8')
  } catch (err) {
    manifestExists = false
  }

  if (!manifestExists) {
    console.log('package-lock.json does not exist in this folder: trying to generate it from package.json...')

    let packageJsonPath = path.resolve(projectPath, './package.json')
    try {
      fs.accessSync(packageJsonPath, fs.constants.R_OK)
    } catch (err) {
      console.log('Cannot find package.json: make sure to specify a Node.js project folder')
      console.error(err)

      process.exit(EXIT_FAILURE)
    }

    let tmpFolder
    try {
      tmpFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'thanc-'))
    } catch (err) {
      console.log('Cannot create temporary folder on the file system')
      console.error(err)

      process.exit(EXIT_FAILURE)
    }

    try {
      fs.copyFileSync(packageJsonPath, `${tmpFolder}/package.json`)
    } catch (err) {
      console.log('Cannot copy package.json file on temp folder')
      console.error(err)

      process.exit(EXIT_FAILURE)
    }

    npm.load({}, err => {
      if (err) return console.error(err)

      npm.config.set('package-lock-only', true)
      npm.commands.install(tmpFolder, [], (err, result) => {
        if (err) return console.error(err)

        console.log(result)
      })
    })
  }

  manifest = JSON.parse(manifest)

  // looking for package-lock.json
  try {
    console.log('Looking for package-lock.json file...')
    const results = await Promise.all([
      asyncAccessFile(`${__dirname}/package-lock.json`, fs.constants.R_OK),
      asyncAccessFile(`${__dirname}/yarn.lock`, fs.constants.R_OK),
      asyncAccessFile(`${__dirname}/package.json`, fs.constants.R_OK)
    ])

    const packageLock = results[0],
      yarnLock = results[0],
      packageJson = results[0]

    if (packageLock) manifest = packageLock
    else if (yarnLock) manifest = yarnLock
    else if (packageJson) manifest = packageJson
  } catch (err) {
    console.log('Cannot find manifest file: you\'re not in a npm/yarn project folder')
    console.error(err)

    process.exit(EXIT_FAILURE)
  }

  if (manifest === undefined) {
    console.error('Cannot find manifest file: you\'re not in a npm/yarn project folder')
    process.exit(EXIT_FAILURE)
  }

  console.log('done!')

  // reading manifest
  let pkg
  try {
    console.log('Reading package-lock.json...')
    const rawManifest = await asyncReadFile(manifest, 'utf-8')
    pkg = JSON.parse(rawManifest)
    console.log('done!')
  } catch (err) {
    console.log('Cannot read package-lock.json')
    console.error(err)

    process.exit(EXIT_FAILURE)
  }

  // generating deps repos promises
  const depsPromises = Object.keys(pkg.dependencies).map(dep => {
    return new Promise((resolve, reject) => {
      client.get(`${NPM_REGISTRY_URL}/${dep}`, {}, (err, data) => {
        if (err) reject(err)
        else resolve(data.versions[pkg.dependencies[dep].version])
      })
    })
  })

  // getting deps repos
  let deps = []
  try {
    console.log('Getting dependencies...')
    deps = await Promise.all(depsPromises)
    console.log('done!')
  } catch (err) {
    console.log('Cannot fetch dependencies\' repos')
    console.error(err)

    process.exit(EXIT_FAILURE)
  }

  // generating repos object: keys are repos and values are owners
  const repos = {}
  deps.forEach((detail) => {
    if (!detail.repository) return

    const splitUrl = detail.repository.url.split('/')
    repos[splitUrl[splitUrl.length - 1].replace('.git', '')] = splitUrl[splitUrl.length - 2]
  })

  prompt.start()

  // getting credentials from the user
  let userInfo
  try {
    console.log('Requesting user info...')
    userInfo = await getUserInfo(schema)
    console.log('done!')
  } catch (err) {
    console.log('Cannot fetch github user credentials')
    console.error(err)

    process.exit(EXIT_FAILURE)
  }

  // testing credentials
  const auth = {username: userInfo.username, password: userInfo.password}
  try {
    console.log('Testing github credentials...')
    await axios({url: GITHUB_API_URL, method: 'get', auth})
    console.log('done!')
  } catch (err) {
    console.log('Invalid credentials or maximum number of login attempts exceeded')
    console.error(err)

    process.exit(EXIT_FAILURE)
  }

  // starring repos
  try {
    console.log('Starring dependencies...')
    await Promise.all(Object.keys(repos).map(repo => axios({url: `${GITHUB_STAR_URL}/${repos[repo]}/${repo}`, method: 'put', auth})))
    console.log('done!')
  } catch (err) {
    console.log('Cannot star dependencies')
    console.error(err)

    process.exit(EXIT_FAILURE)
  }
})()
