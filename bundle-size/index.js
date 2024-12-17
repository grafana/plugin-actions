// @ts-check

const {
  getComment,
  getPrMessageSymbol,
  getBelowThresholdComment,
} = require("./comment");
const { compareStats } = require("./compareStats");

module.exports = async (
  { core, context, github },
  threshold,
  mainStatsFile,
  prStatsFile,
  workingDirectory
) => {
  try {
    const {
      payload: { pull_request },
      repo,
    } = context;

    if (!pull_request) {
      core.info(
        "This action is intended to run only on pull_request events. Exiting... 🚪"
      );
      return;
    }

    const prNumber = pull_request.number;
    const diffThreshold = parseInt(threshold, 10);
    console.log("Comparing stats... 🔍");
    const { assetsDiff, modulesDiff, entriesDiff } = compareStats(
      mainStatsFile,
      prStatsFile
    );
    console.log("Comparing stats done. 👍");

    console.log("Checking PR comments... 📝");
    const { data: comments } = await github.rest.issues.listComments({
      ...repo,
      issue_number: prNumber,
    });

    const [previousComment, ...restComments] = comments.filter(
      (comment) =>
        comment.body &&
        comment.body.includes(getPrMessageSymbol(workingDirectory))
    );

    if (restComments.length > 1) {
      console.log("Cleaning up comments... 🧹");
      for (const comment of restComments) {
        await github.rest.issues.deleteComment({
          ...repo,
          comment_id: comment.id,
        });
      }
    }

    if (
      entriesDiff.total.diffPercentage >= 0 &&
      entriesDiff.total.diffPercentage < diffThreshold
    ) {
      const msg = `Total entrypoint size increase of ${entriesDiff.total.diffPercentage}% is below threshold of ${diffThreshold}%. Exiting... 🚪`;
      if (previousComment) {
        console.log("Updating PR comment... 🔄");
        await github.rest.issues.updateComment({
          ...repo,
          comment_id: previousComment.id,
          body: getBelowThresholdComment(
            entriesDiff.total.diffPercentage,
            diffThreshold
          ),
        });
      }
      console.log(`${msg}`);
      core.setOutput(msg);
      return;
    }

    const commentBody = getComment(
      assetsDiff,
      modulesDiff,
      entriesDiff,
      workingDirectory
    );

    if (previousComment) {
      console.log("Updating PR comment... 🔄");
      await github.rest.issues.updateComment({
        ...repo,
        comment_id: previousComment.id,
        body: commentBody,
      });
    } else {
      console.log("Creating PR comment... 📝");
      await github.rest.issues.createComment({
        ...repo,
        issue_number: prNumber,
        body: commentBody,
      });
    }

    console.log("Finished. 🎉");
    core.setOutput("Finished.", commentBody);
  } catch (error) {
    core.setFailed(error.message);
  }
};
