import re
import sys

def test_admin_productsm():
    with open('p/admin-productsm.html', 'r', encoding='utf-8') as f:
        content = f.read()

    assert 'id="fIsHidden"' in content, "Missing #fIsHidden checkbox element in modal form"
    assert 'is_hidden: document.getElementById(\'fIsHidden\').checked' in content, "Missing is_hidden in submitForm data"
    assert 'document.getElementById(\'fIsHidden\').checked = p.is_hidden || false;' in content, "Missing fIsHidden setting in openEditModal"
    assert 'document.getElementById(\'fIsHidden\').checked = false;' in content, "Missing fIsHidden reset in resetForm"
    assert 'p.is_hidden' in content, "Missing p.is_hidden badge rendering in renderProducts"
    print("✅ p/admin-productsm.html verification passed!")

def test_index_html():
    with open('index.html', 'r', encoding='utf-8') as f:
        content = f.read()

    assert '.filter(p => !p.is_hidden)' in content or 'p.is_hidden' in content, "Missing is_hidden filtering in index.html"
    print("✅ index.html verification passed!")

if __name__ == '__main__':
    test_admin_productsm()
    test_index_html()
    print("ALL TESTS PASSED SUCCESSFULLY!")
