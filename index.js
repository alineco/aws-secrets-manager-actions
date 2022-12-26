const core = require('@actions/core')
const aws = require('aws-sdk')
const fs = require('fs')

const outputPath = core.getInput('OUTPUT_PATH')
const secretName = core.getInput('SECRET_NAME')
const nonMaskedSecrets = new Set(
  core.getMultilineInput('NON_MASKED_SECRETS').map((s) => s.toLowerCase())
)

const secretsManager = new aws.SecretsManager({
  accessKeyId: core.getInput('AWS_ACCESS_KEY_ID'),
  secretAccessKey: core.getInput('AWS_SECRET_ACCESS_KEY'),
  region: core.getInput('AWS_DEFAULT_REGION')
})

async function getSecretValue (secretsManager, secretName) {
  return secretsManager.getSecretValue({ SecretId: secretName }).promise()
}

getSecretValue(secretsManager, secretName)
  .then((resp) => {
    const secretString = resp.SecretString
    core.setSecret(secretString)

    if (!secretString) {
      core.error(`${secretName} has no secret values`)
      return
    }

    try {
      const parsedSecret = JSON.parse(secretString)
      const secretsAsEnv = Object.entries(parsedSecret)
        .map(([key, value]) => `${key}=${value}`)
        .join('\n')

      core.info(`New env file ${outputPath}`)
      core.info(secretsAsEnv)

      fs.writeFileSync(outputPath, secretsAsEnv)

      Object.entries(parsedSecret)
        .filter(([key]) => !nonMaskedSecrets.has(key.toLowerCase()))
        .forEach(([_, value]) => {
          core.setSecret(value)
        })
    } catch (e) {
      core.warning(
        'Parsing asm secret is failed. Secret will be store in asm_secret'
      )
      fs.writeFileSync(outputPath, secretString)
    }
  })
  .catch((err) => {
    core.setFailed(err)
  })

exports.getSecretValue = getSecretValue
