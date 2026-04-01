# TODO

## Main Goals
- Build a server management modal
- Build a channel management modal
- Add a user profile page
- Allow editing user profiles
- Verify backup emails
- Allow creating and deleting channels and categories
- Finish integrating the database (server settings, users, channels, messages, group chats, etc.)
- Implement more API endpoints
- Add Markdown support for messages
- Add file upload & embed support
- Add link embeds in messages
- Add direct messaging between other users
- Allow blocking users
- Add roles and permissions
- Add report system
- Allow moderators to mute or ban users
- Add audit log for mod actions
- Add mod queue for reports

## Stretch Goals
- E2E encryption
- Voice/video calls
- Cross-platform compatibility with Discord and maybe Root via Discord bot/webhook
- Premium paid features and/or donations to help support infrastructure costs (maybe)
- 2-factor authentication
- Forums channels

---

# Current Branch Todo List (notifications)

- Implement user mentions and pings (@everyone, @role, @user)
- Scroll to the message upon clicking on the notification
- Only make notification sounds in browser if electron is not also open (not sure how to do this one but I have ideas)

## Mentions Todo List

- Parse message content on loading channel messages and receiving a new realtime message
  - Look for pattern `<@!user_id>` and replace with a styled user mention.
  - If the user ID is the current logged in user's ID, restyle the whole message to be highlighted.
- Parse message content while typing and autocomplete user mentions
  - Autocomplete should fuzzy search username and display name. 
  - Press tab to select and autofill the first matching user.
  - Press arrow keys to cycle through the matching users.
  - Display a styled user mention in place of pattern `<@!user_id>` in the message input box.
  - Backspace on this styled mention should remove the whole mention.
- Add logic when sending notifications to check if the message mentions the current logged in user.
- Parse message content in notifications and replace `<@!user_id>` with `@Display Name`.
