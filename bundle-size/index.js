// @ts-check

const {
  getComment,
  prMessageSymbol,
  getBelowThresholdComment,
} = require("./comment");
const { compareStats } = require("./compareStats");

module.exports = async (
  { core, context, github },
  threshold,
  mainStatsFile,
  prStatsFile
) => {
  try {
    const {
      payload: { pull_request },
      repo,
    } = context;
    const prNumber = pull_request.number;
    console.log("Comparing stats... 🔍");
    const { assetsDiff, modulesDiff, entriesDiff } = compareStats(
      mainStatsFile,
      prStatsFile
    );
    console.log("Comparing stats done. 👍");
    const diffThreshold = parseInt(threshold, 10);
    const commentBody = getComment(assetsDiff, modulesDiff, entriesDiff);
    console.log("Checking PR comments... 📝");
    const { data: comments } = await github.rest.issues.listComments({
      ...repo,
      issue_number: prNumber,
    });

    const [previousComment, ...restComments] = comments.filter(
      (comment) => comment.body && comment.body.includes(prMessageSymbol)
    );

    if (restComments.length > 1) {
      console.log("Cleaning up old comments... 🧹");
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
