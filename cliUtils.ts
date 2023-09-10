import prompts from 'prompts';
import { ZodFirstPartySchemaTypes } from 'zod';

export type MenuItem = {
  name: string;
  value: () => Promise<void>;
};

export type Menu = {
  name: string;
  submenus?: Record<string, Menu>;
  items?: MenuItem[];
};

const menuStack: Menu[] = [];
let LAST_ACTION_CANCEL = false;
const CLEAR_SCREEN = true;

export async function runMenu(currentMenu: Menu) {
  const choices = [];
  if (menuStack.length === 0) {
    menuStack[0] = currentMenu;
  }

  if (currentMenu.submenus) {
    for (const submenu of Object.values(currentMenu.submenus)) {
      choices.push({ title: submenu.name, value: submenu });
    }
  }

  if (currentMenu.items) {
    for (const item of currentMenu.items) {
      choices.push({ title: item.name, value: item });
    }
  }

  if (menuStack.length > 1) {
    choices.push({ title: 'Back', value: 'Back' });
  }

  const { selected } = await prompts(
    {
      type: 'select',
      name: 'selected',
      message: 'Select an operation',
      choices,
    },
    globalPromptOptions,
  );

  // If selected is undefined, it means the user pressed Ctrl+C or Esc and we just ignore it
  if (selected === undefined) {
    return;
  }

  if (CLEAR_SCREEN) {
    console.clear();
  }

  // If the selected option is "Back" we pop the current menu from the stack and run the previous menu
  if (selected === 'Back') {
    menuStack.pop();
    await runMenu(menuStack[menuStack.length - 1]);
    return;
  }

  // If the selected option is a submenu or a menu item with submenus or items, we push it to the stack and run it
  if ('submenus' in selected || 'items' in selected) {
    menuStack.push(selected);
    await runMenu(selected);
    return;
  }

  // Selected option is a Action so we run it and then return to the current menu
  await selected.value();
  await runMenu(menuStack[menuStack.length - 1]);
}

export const globalPromptOptions: prompts.Options = {
  onCancel: async () => {
    // If the last action was cancel, we exit the process
    if (LAST_ACTION_CANCEL) {
      console.log('Bye!');
      process.exit(0);
    }

    // If the last action was not cancel, we set the flag and run the main menu
    LAST_ACTION_CANCEL = true;
    menuStack.splice(1, menuStack.length - 1);
    await runMenu(menuStack[0]);
  },
  onSubmit: () => {
    LAST_ACTION_CANCEL = false;
  },
};

export const validateWithZod = (zodObject: ZodFirstPartySchemaTypes) => {
  return async (value: any) => {
    const result = zodObject.safeParse(value);
    if (result.success === true) {
      return true;
    }

    return result.error.issues.map((issue) => issue.message).join('\n');
  };
};
