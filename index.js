const axios = require('axios')
const prompt = require('prompt')
const fs = require('fs')
const program = require('commander')
const path = require('path')
const npm = require('npm')
const os = require('os')
const RegistryClient = require('npm-registry-client')

const client = new RegistryClient()
const NPM_REGISTRY_URL = 'https://registry.npmjs.org'
const GITHUB_API_URL = 'https://api.github.com'
const GITHUB_STAR_URL = `${GITHUB_API_URL}/user/starred`
const EXIT_FAILURE = 1

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

// generate lock file from package.json
const generateLockFile = async projectPath => {
  return new Promise((resolve, reject) => {
    // testing package.json (if it does exist or not)
    let packageJsonPath = path.resolve(projectPath, './package.json')
    try {
      fs.accessSync(packageJsonPath, fs.constants.R_OK)
    } catch (err) {
      console.log('Cannot find package.json: make sure to specify a Node.js project folder')
      return reject(err)
    }

    // creating tmp folder
    let tmpFolder
    try {
      tmpFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'thanc-'))
    } catch (err) {
      console.log('Cannot create temporary folder on the file system')
      return reject(err)
    }

    // copying package.json into tmp folder
    try {
      fs.copyFileSync(packageJsonPath, `${tmpFolder}/package.json`)
    } catch (err) {
      console.log('Cannot copy package.json file on temp folder')
      return reject(err)
    }

    // loading npm
    npm.load({}, err => {
      if (err) {
        console.log('Cannot load NPM')
        return reject(err)
      }

      // generating package-lock.json file, without installing deps
      npm.config.set('package-lock-only', true)
      npm.commands.install(tmpFolder, [], err => {
        if (err) {
          console.log('Cannot generate package-lock.json inside temp folder')
          return reject(err)
        }

        resolve(`${tmpFolder}/package-lock.json`)
      })
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
    console.log('Reading package-lock.json file...')
    manifest = fs.readFileSync(path.resolve(projectPath, './package-lock.json'), 'utf-8')
  } catch (err) {
    manifestExists = false
  }

  if (!manifestExists) {
    try {
      console.log('package-lock.json does not exist in this folder: generating it from package.json...')
      const manifestPath = await generateLockFile(projectPath)
      manifest = fs.readFileSync(manifestPath, 'utf-8')
    } catch (err) {
      console.error(err)

      process.exit(EXIT_FAILURE)
    }
  }

  try {
    // parsing package-lock.json file
    manifest = JSON.parse(manifest)
  } catch (err) {
    console.log('Cannot parse package-lock.json file')

    console.error(err)
    process.exit(EXIT_FAILURE)
  }

  console.log('done!')

  // generating deps repos promises
  const depsPromises = Object.keys(manifest.dependencies).map(dep => {
    return new Promise((resolve, reject) => {
      client.get(`${NPM_REGISTRY_URL}/${dep}`, {}, (err, data) => {
        if (err) reject(err)
        else resolve(data.versions[manifest.dependencies[dep].version])
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
