import { ChefHat } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { RecipeDraftForm } from "@/components/recipe-draft-form";
import { hasCapability } from "@/lib/auth/capabilities";
import { requireCapability } from "@/lib/auth/session";
import { listRecipeChoices, listRecipes } from "@/services/recipes/drafts";

export default async function RecipesPage() {
  const session = await requireCapability("inventory:view-cost");
  const organizationId = session.organizationId;
  const canEdit = hasCapability(session.role, "inventory:adjust");
  const [recipes, choices] = organizationId
    ? await Promise.all([listRecipes(organizationId), listRecipeChoices(organizationId)])
    : [[], { products: [], units: [] }] as const;

  return (
    <>
      <PageHeader
        eyebrow="Recipes"
        title="What goes into each item"
        description="A draft records the ingredients in one yield. Theoretical cost uses these amounts after a count is posted. Nothing here changes inventory yet."
      />

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Recipe book</h2>
            <p>{recipes.length === 0 ? "No recipes saved yet." : `${recipes.length} recipes for this company.`}</p>
          </div>
          <ChefHat size={18} aria-hidden="true" />
        </div>
        {recipes.length === 0 ? (
          <p className="panel-body metric-note">Start with the drinks and prep batches you make every day.</p>
        ) : (
          <ul className="recipe-book">
            {recipes.map((recipe) => (
              <li key={recipe.id}>
                <div>
                  <strong>{recipe.name}</strong>
                  <p>
                    Makes {trimQuantity(recipe.yieldQuantity)} {recipe.yieldSymbol} of {recipe.outputName}
                  </p>
                </div>
                <span>
                  {recipe.ingredientCount} ingredients · {recipe.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {canEdit && choices.products.length === 0 ? (
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>New draft</h2>
              <p>Post the inventory catalog first. A recipe needs those products as its finished item and its ingredients.</p>
            </div>
          </div>
        </section>
      ) : null}

      {canEdit && choices.products.length > 0 ? (
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>New draft</h2>
              <p>Waste percent is the part of an ingredient that is trimmed or spilled before it reaches the cup.</p>
            </div>
          </div>
          <RecipeDraftForm
            products={choices.products.map((product) => ({
              id: product.id,
              label: product.sku ? `${product.name} · ${product.sku}` : product.name,
            }))}
            units={choices.units.map((unit) => ({
              id: unit.id,
              label: unit.symbol ? `${unit.name} (${unit.symbol})` : unit.name,
            }))}
          />
        </section>
      ) : null}
    </>
  );
}

function trimQuantity(value: string): string {
  return value.replace(/(\.\d*?[1-9])0+$/, "$1").replace(/\.0+$/, "");
}
