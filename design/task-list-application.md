# A Task List Application

Here are some thoughts about a task list application, with two basic tenets: I would want to use it, and it should have only a few basic concepts built in, with the rest building off of that.

(_Idea._ The name could be based on "tasx" or "taskx", like "SaveTasx", "theTaskx", "TeamTasx", "doTaskx", or something like that.)

(_Idea._ Perhaps use "action" instead of "task"? That perhaps emphasizes even more that the tasks are statements about what needs to be done.)

## General

The application should preferably work for _any task size_, both fine-grained for personal todo lists, and course-grained for project management.

However, the focus of the application is on the tasks' _statement_ (what other systems call a 'summary'), which is just a single line. A more detailed description or comments are usually not immediately visible in the UI. This might make the application more suited to fine-grained tasks.

The basic concept is called a task (as opposed to 'issue' or 'bug' or 'item') because I intend it to be something the assignee has to do. Therefore we encourage the task statement to be a command, an imperative. (E.g., not "Cancel button not enabled in file dialog" but rather "Investigate why cancel button not enabled in file dialog", or even "Fix bug: cancel button not enabled in file dialog".)

Every task is in exactly one of 4 states: _Open_, _Active_, _Done_, and _Skipped_. (And the transitions are called 'start', 'complete', 'pause', 'reopen', and 'skip'.)

                 skip              start             complete
            +-------------+    +-------------+    +------------+
            v             |    |             v    |            v
    +---------+         +--------+         +--------+        +--------+
    | Skipped |         |  Open  |         | Active |        |  Done  |
    +---------+         +--------+         +--------+        +--------+
            |             ^    ^             |                 |
            +-------------+    +-------------+<----------------+
                reopen              pause             reopen

The set of states and transitions is intentionally kept as limited as possible, and cannot be extended dynamically. Specifically:

- There is no explicit Paused or Suspended state. Tasks should be small enough to be kept Active until completion, after all prerequisite tasks have been completed. If you need to wait for something mid-task, split off the completed part, and add a prerequisite task (even if it is just 'wait for xyzzy').
- There is no Resolved or ToBeVerified state. For that, make this task the prerequisite of a new a 'verify' task. (TODO: A verification process is modeled by creating a separate 'verify' task, perhaps automatically when reassigning the original task to someone else.)
- Tasks are never deleted: instead, they are Skipped, and perhaps marked with a reason why: duplicated, incorrectly created, etc. Skipped tasks are by default hidden from all views.

## Dependencies

Task can have two kinds of dependencies: _necessary for_ and _more important than_. There are no other dependencies. We do not allow circular dependencies, like 'A necessary for A', or 'A necessary for B and B necessary for A', etc.; and similarly for 'more important than'.

(_Issue._ It might be difficult / not user-friendly to always forbid cycles. However, having a cycle means that suddenly all tasks in the cycle have the same importance, or that they all must be done at the same time. In other words, they make the work order (below) partially useless, which is not nice. _Idea._ Allow cycles, and warn about them, and then break each cycle by removing the dependency that was last added. However, is this well-defined? Perhaps mark a cycle-introducing dependency in a special way, and warn about such marked dependencies, and ignore them when calculating/showing orders. And remove the mark at the time the dependency becomes not part of any cycle anymore.)

(TODO: Explain 'tracking' tasks, which are tasks that cannot be started, and are completed automatically after all 'necessary for' prerequisites have been completed. Their state is a sum or summary of the states of those prerequisites.)

The first kind of dependency is used to limit what can be done with a task: 'A necessary for B' means that A has to be Done or Skipped before B can be completed, so set to Done.

(TODO: Explain how these replace various other concepts like sub-tasks and duplicates.)

## Work order

Both types of dependencies are used together, to display the order in which the tasks should be worked on.

Formally, the _work order_ is a directed graph / partial order where 'A _before_ B' is defined as 'A (directly or indirectly) necessary for B; or A (directly or indirectly) more important than B and B not (directly or indirectly) necessary for A'. (Whenever we need to flatten/serialize the work order, then the least recently updated task is put first. _Rationale._ This will make it more difficult to forget tasks.)

The UI will directly show this work order, as a mix of sequential and parallel lists of tasks (so in a [series-parallel order](https://en.wikipedia.org/wiki/Series-parallel_partial_order)). (_Detail._ In some cases, it may have to show an approximation of the work order, for example in the following scenario:

        adopt widget extension <-- extend widget --> build screen <-- mock-up screen

This 'N'-shape or 'fence' or 'zigzag' would probably be resolved by assuming that the last task (`mock-up screen`) goes before the first (`adopt widget extension`), leading to a UI order like

    >>  ||  extend widget
    >>  ||  mock-up screen
    >>
    >>  ||  adopt widget extension
    >>  ||  build screen

which means that first the first two tasks should done in either order, and then the last two in either order. Of course this additional assumption has no meaning for the end user, and it would only be used in determining the display order in the UI.)

The UI could also do some fancy highlighting to show the direct and indirect dependencies and dependents for any task.

## Users and queues (TODO: term: user groups? teams?)

Every task has a single owner, and that owner is responsible for performing that task.

(TODO)

## Task groups

To allow triaging into priority groups ('major' / 'minor' / 'trivial', etc.), and to allow grouping together tasks for a project or sub-project, one can define _task groups_. A task group is a kind of 'abstract task': it can have most properties of a task, including dependencies, and those are inherited by all tasks in the group. That way one can create groups 'Major' and 'Minor', and make the former more important than the latter.

A task can be in multiple groups. (But a task can not be in two groups that depend on each other, since that would lead to circularity. _Except._ As said above, we could allow circularity and warn about it.)

(Note that groups can replace tags, 'affects version', 'fixed in version', etc.)

## (TODO: comments, threads, and attachments)

## Wrapping and tracking tasks/issues/bugs from other systems

It should be easy to take existing things and turn them into tasks. There are two ways to do that: _wrap_ and _track_. (TODO: Use different name for 'track external thing' and 'track another task'. Or are these concepts really the same concept?)

To _wrap_ a task around some existing item, the task simply points to that item: a web page, an email, a blog post.

To _track_ an external item is a deeper level of integration: point to, e.g., an existing Jira deployment, and generate/update one or more tasks corresponding to issues in that Jira system. (Note that the external item could correspond to multiple tasks: "Resolve PROJ-453", "Retest PROJ-453", etc. So such an integration would not be trivial, and it would be following the external tool's workflows.)

## IDEAS

### Communication

Perhaps this system could even become a fine-grained communication medium.

For example, to complete task "Do A" I need some information from my colleague. So I create a task "Answer this: how to B?" and assign it to them, and register that B is necessary for A.

In this way perhaps even some kind of chat/discussion could arise, when tasks are sub-divided and clarified in a fine-grained way.
