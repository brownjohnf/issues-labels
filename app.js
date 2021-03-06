#!/usr/bin/env node

const
  Promise = require("bluebird"),
  GitHubApi = Promise.promisifyAll(require("github")),
  _ = require("lodash")
  ;

const
  regex = new RegExp(process.argv[2], 'i')
  ;

const github = new GitHubApi({
  // optional
  debug: false,
  protocol: "https",
  followRedirects: false, // default: true
  timeout: 5000
});

// set up a helper function for authenticating with github
let authenticate = () => {
  github.authenticate({
    type: "basic",
    username: process.env.GITHUB_USER,
    password: process.env.GITHUB_TOKEN
  });
};

// fetch the issues/labels for all passed repos
let run = () => {
  while (process.argv.length > 3) {
    const
      fqRepo = process.argv.pop(),
      [user, repo] = fqRepo.split("/")
      ;

    fetch(user, repo);
  }
};

const testLabel = (l) => {
  return regex.test(l.name);
};

let fetch = (user, repo) => {
  authenticate();
  github.repos.getCommits({
    user,
    repo,
    sha: "production"
  }).then(([ ghCommit ]) => {
    authenticate();

    return github.issues.getForRepo({
      user,
      repo,
      state: "all",
      base: "master",
      sort: "updated",
      order: "desc",
      since: ghCommit.commit.author.date
    });
  }).then((issues) => {
    const json = {};

    // iterate through each issue
    _.each(issues, (issue) => {
      // grab the labels we care about
      issue.labels.filter(testLabel).forEach((label) => {
        if (json[label.name] == null) {
          json[label.name] = [];
        }

        json[label.name].push(issue);
      });
    });

    // output the issues grouped by label
    console.log(`\n==> ${user}/${repo} ${"=".repeat(74 - (user.length + repo.length))}`);
    console.log(`    https://github.com/${user}/${repo}`);
    _.forOwn(json, (messages, label) => {
      console.log(`--> ${label}`);

      _.each(messages, (msg) => {
        console.log(`    - ${msg.title}\n        (${msg.url})`);
      });
    });
  }).catch((err) => {
    console.error(`${process.argv[1]}: error:`, err, err.stack);
    process.exit(1);
  });
};

run();

